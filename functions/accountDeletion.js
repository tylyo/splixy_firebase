"use strict";
/**
 * Eliminazione dell'account, in due fasi come in matrimoni.
 *
 * Fase 1, deleteUser (callable, chiamata dall'app): il profilo /users/{uid} viene spostato in
 * /usersDeleted/{uid} insieme ai dati di Firebase Authentication, alla data della richiesta e
 * alla data di cancellazione definitiva (purgeAt); l'utente viene disabilitato e le sue sessioni
 * revocate; i token delle notifiche vengono eliminati subito.
 * Fase 2, purgeDeletedUsers (ogni 24 ore): dopo DELETION_GRACE_DAYS giorni toglie l'utente dai
 * wallet (vedi accountCleanup.js), elimina i suoi dati residui, i file su Storage e l'utente da
 * Authentication, e lascia in /usersDeleted/{uid} solo un record senza dati personali.
 * requestAccountDeletion (HTTP): richiesta dalla pagina pubblica per chi non riesce più ad accedere
 * all'app; viene solo accodata in /deletionRequests per la lavorazione manuale.
 */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const adminDB = admin.database();
const {
  COLLECTION_JOINREQUEST,
  COLLECTION_USERS,
  COLLECTION_WALLETS,
  currentTM,
} = require("./commons");
const {planWalletExit} = require("./accountCleanup");

const COLLECTION_DELETION_REQUESTS = "deletionRequests";
const COLLECTION_USERS_DELETED = "usersDeleted";
// nodi indicizzati per uid: i token delle notifiche si eliminano subito, il resto alla cancellazione definitiva
const NODES_REMOVED_NOW = ["fcmTokens", "apnToken"];
const NODES_REMOVED_AT_PURGE = ["purchases", COLLECTION_JOINREQUEST];
const DELETION_GRACE_DAYS = 30;
const SECONDS_PER_DAY = 86400;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELETION_REASONS = [
  "not_using",
  "privacy_concerns",
  "duplicate_account",
  "trip_completed",
  "too_many_notifications",
  "not_satisfied",
  "other",
];

/**
 * Id dei wallet a cui l'utente partecipa: l'elenco g del suo profilo (/users/{uid}/g, mantenuto dall'app
 * per ogni wallet creato o a cui ci si unisce, e archiviato in /usersDeleted/{uid} dalla fase 1).
 * Non si interroga /wallets per acl/c: servirebbe un indice per utente e senza si scaricano tutti i wallet.
 * @param {object} rec record archiviato in /usersDeleted/{uid}
 * @return {string[]} id dei wallet
 */
function walletIdsOf(rec) {
  return Object.keys((rec && rec.g) || {});
}

/**
 * Toglie l'utente da tutti i suoi wallet. Solleva eccezione in caso di errore, così la
 * cancellazione dell'utente viene ritentata al giro successivo.
 * @param {string} uid utente
 * @param {object} rec record archiviato in /usersDeleted/{uid}
 * @return {Promise<{deleted: number, left: number}>} wallet eliminati e wallet lasciati agli altri
 */
async function removeUserFromWallets(uid, rec) {
  let deleted = 0;
  let left = 0;
  for (const walletId of walletIdsOf(rec)) {
    const snap = await adminDB.ref(COLLECTION_WALLETS).child(walletId).get();
    if (!snap.exists()) continue;

    const plan = planWalletExit(walletId, snap.val(), uid);
    if (plan.newCreator) {
      const name = (await adminDB.ref(COLLECTION_USERS).child(plan.newCreator).child("displayName").get()).val();
      plan.updates[`${COLLECTION_WALLETS}/${walletId}/creator`] = {[plan.newCreator]: name || "Member"};
    }
    await adminDB.ref().update(plan.updates);
    if (plan.action === "delete") deleted++;
    else left++;
  }
  return {deleted, left};
}

/**
 * Elimina i file dell'utente su Cloud Storage (foto profilo).
 * @param {string} uid utente
 */
async function deleteUserFiles(uid) {
  try {
    await admin.storage().bucket().deleteFiles({prefix: `${COLLECTION_USERS}/${uid}/`});
  } catch (err) {
    functions.logger.error("purge -- storage delete failed -- uid:%s", uid, err);
  }
}

/**
 * Callable: elimina l'account dell'utente autenticato (fase 1). L'uid arriva da context.auth,
 * mai dai parametri: un utente può eliminare solo il proprio account.
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  functions.logger.log("deleteUser -- start -- uid:%s", uid);

  const userRecord = await admin.auth().getUser(uid);
  const userSnap = await adminDB.ref(`${COLLECTION_USERS}/${uid}`).get();
  const userData = userSnap.exists() ? userSnap.val() : {};

  const now = currentTM();
  const archived = Object.assign({}, userData, {
    auth: {
      email: userRecord.email || null,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName || null,
      photoURL: userRecord.photoURL || null,
      phoneNumber: userRecord.phoneNumber || null,
      disabled: userRecord.disabled,
      providers: userRecord.providerData.map((p) => p.providerId),
      createdAt: userRecord.metadata.creationTime || null,
      lastSignInAt: userRecord.metadata.lastSignInTime || null,
    },
    deletionRequestedAt: now,
    purgeAt: now + DELETION_GRACE_DAYS * SECONDS_PER_DAY,
  });

  // spostamento atomico: copia in usersDeleted e rimozione da users
  await adminDB.ref().update({
    [`${COLLECTION_USERS_DELETED}/${uid}`]: archived,
    [`${COLLECTION_USERS}/${uid}`]: null,
  });

  try {
    await admin.auth().updateUser(uid, {disabled: true});
    await admin.auth().revokeRefreshTokens(uid);
  } catch (err) {
    functions.logger.error("deleteUser -- disable failed, rollback -- uid:%s", uid, err);
    await adminDB.ref().update({
      [`${COLLECTION_USERS}/${uid}`]: userSnap.exists() ? userData : null,
      [`${COLLECTION_USERS_DELETED}/${uid}`]: null,
    });
    throw new functions.https.HttpsError("internal", "Unable to delete the account.");
  }

  const tokens = {};
  NODES_REMOVED_NOW.forEach((node) => {
    tokens[`${node}/${uid}`] = null;
  });
  await adminDB.ref().update(tokens);

  functions.logger.log("deleteUser -- done (disabled, purge at %s) -- uid:%s", archived.purgeAt, uid);
  return {success: true};
});

/**
 * Scheduled (ogni 24 ore): cancellazione definitiva (fase 2) degli account disabilitati da deleteUser
 * la cui data purgeAt è scaduta. Un errore su un utente non blocca gli altri: viene ritentato al giro dopo.
 */
exports.purgeDeletedUsers = functions.pubsub.schedule("every 24 hours").onRun(async () => {
  const now = currentTM();
  const snap = await adminDB.ref(COLLECTION_USERS_DELETED).orderByChild("purgeAt").endAt(now).get();
  if (!snap.exists()) {
    functions.logger.log("purgeDeletedUsers -- nothing to purge");
    return null;
  }

  let purged = 0;
  for (const [uid, rec] of Object.entries(snap.val())) {
    if (!rec || typeof rec.purgeAt !== "number") continue;
    try {
      const wallets = await removeUserFromWallets(uid, rec);
      functions.logger.log("purgeDeletedUsers -- wallets deleted:%s left:%s -- uid:%s", wallets.deleted, wallets.left, uid);

      const nodes = {};
      [...NODES_REMOVED_NOW, ...NODES_REMOVED_AT_PURGE].forEach((node) => {
        nodes[`${node}/${uid}`] = null;
      });
      await adminDB.ref().update(nodes);
      await deleteUserFiles(uid);

      try {
        await admin.auth().deleteUser(uid);
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }
      await adminDB.ref(`${COLLECTION_USERS_DELETED}/${uid}`).set({
        deletionRequestedAt: rec.deletionRequestedAt || null,
        purgedAt: now,
      });
      purged++;
    } catch (err) {
      functions.logger.error("purgeDeletedUsers -- failed -- uid:%s", uid, err);
    }
  }
  functions.logger.log("purgeDeletedUsers -- purged:%s", purged);
  return null;
});

/**
 * HTTP: richiesta di eliminazione dalla pagina pubblica (nessuna autenticazione: l'utente potrebbe non
 * riuscire più ad accedere). Viene solo accodata in /deletionRequests, senza eliminare nulla in automatico.
 * Body: { email: string, reason: string, reasonDetail?: string }
 */
exports.requestAccountDeletion = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed."});
    return;
  }

  const {email, reason, reasonDetail} = req.body || {};
  if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({error: "Invalid email."});
    return;
  }
  if (typeof reason !== "string" || !DELETION_REASONS.includes(reason)) {
    res.status(400).json({error: "Invalid reason."});
    return;
  }

  await adminDB.ref(COLLECTION_DELETION_REQUESTS).push({
    email: email.trim().toLowerCase(),
    reason,
    reasonDetail: reason === "other" && typeof reasonDetail === "string" ? reasonDetail.trim().slice(0, 500) : null,
    status: "pending",
    createdAt: currentTM(),
  });

  functions.logger.log("requestAccountDeletion -- queued -- reason:%s", reason);
  res.status(200).json({success: true});
});
