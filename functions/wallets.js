"use strict";
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const adminDB = admin.database();
const {
  COLLECTION_WALLETS,
  COLLECTION_TRANSACTIONS,
  PATH_SEPARATOR,
  currentTM,
} = require("./commons");
const {WalletMember} = require("./models");
const {walletQuotasCalculate} = require("./walletQuotas");

/**
 * Valori iniziali di un wallet appena creato.
 * @param {object} context contesto del trigger
 * @return {object} aggiornamenti da applicare al nodo
 */
function buildCreationParams(context) {
  const uid = context.auth.uid;
  const creator = {};
  creator[uid] = "User";
  const contextName = context.auth.token.name;
  if (contextName !== undefined && contextName !== null) {
    creator[uid] = contextName;
  }
  const updates = {};
  const uidACL = {};
  uidACL[uid] = true;

  updates["acl/r/" + uid + PATH_SEPARATOR] = true;
  updates["acl/w/" + uid + PATH_SEPARATOR] = true;
  updates["acl/c/"] = uidACL;
  updates["creator"] = creator;
  updates["created"] = currentTM();
  updates["updated"] = currentTM();

  return updates;
}

/**
 * Valori del primo giocatore del wallet.
 * @param {object} context contesto del trigger
 * @return {object} aggiornamenti da applicare al nodo
 */
function buildwalletOnCreate(context) {
  const uid = context.auth.uid;
  const updates = {};

  const firstplayer = "teams/t1/players/t1_p1";
  updates[firstplayer + "/u"] = uid;

  if (context.auth.token.email !== undefined) {
    let nick = context.auth.token.email.split("@", 1)[0];
    nick = nick.replace(/\./, " ");
    if (nick.length > 15) {
      nick = nick.substring(0, 15);
    }
    updates[firstplayer + "/name"] = nick;
  }
  console.log("creation updates:" + JSON.stringify(updates));
  return updates;
}

/**
 * Aggiorna la data di ultima modifica del wallet.
 * @param {string} walletId id del wallet
 */
function walletUpdatedRefresh(walletId) {
  adminDB.ref(COLLECTION_WALLETS + PATH_SEPARATOR + walletId + "/updated").set(currentTM());
}

// NB: oggi l'unico effetto è il log: gli aggiornamenti calcolati non vengono scritti
exports.walletCreate = functions.database.ref("/" + COLLECTION_WALLETS + "/{walletId}").onCreate((snap, context) => {
  const creationUpdates = buildCreationParams(context);
  console.log("creationUpdates: " + JSON.stringify(creationUpdates));
  const walletUpdates = buildwalletOnCreate(context);
  console.log("walletUpdates: " + JSON.stringify(walletUpdates));
  if (!snap.hasChild("playerId")) {
    for (const x in walletUpdates) {
      if (Object.prototype.hasOwnProperty.call(walletUpdates, x)) {
        creationUpdates[x] = walletUpdates[x];
      }
    }
  }

  console.log("val: " + JSON.stringify(snap.val()));
  return snap;
});

// NB: oggi non elimina le transazioni del wallet (crea il riferimento ma non lo usa)
exports.walletDelete = functions.database.ref("/wallets/{walletId}").onDelete((snap, context) => {
  const walletId = context.params.walletId;
  console.log("val: " + JSON.stringify(snap.val()));
  adminDB.ref(COLLECTION_TRANSACTIONS + PATH_SEPARATOR + walletId);
  return snap;
});

exports.walletNameUpdate = functions.database.ref("/wallets/{walletId}/name").onUpdate((change, context) => {
  console.log("walletNameUpdate start");
  const walletId = context.params.walletId;
  const changed = change.after;
  if (changed.length === 0) {
    change.after = change.before;
  } else if (changed.length > 30) {
    change.after = changed.substring(0, 30);
  }
  walletUpdatedRefresh(walletId);
  return change;
});

/**
 * Crea il link di condivisione: registra la data di creazione.
 */
exports.walletshareCreate = functions.database.ref("/wallets/{walletId}/sl/").onWrite((change, context) => {
  console.log("walletshareCreate -- start --");
  console.log(JSON.stringify(change));
  const walletId = context.params.walletId;

  adminDB.ref(COLLECTION_WALLETS).child(walletId).child("slCreated").set(currentTM());
  return change.ref;
});

/**
 * Ricalcola le quote di tutti i membri quando l'app scrive /wallets/{walletId}/updQuota.
 */
exports.walletUpdateQuotas = functions.database.ref("/wallets/{walletId}/updQuota/").onWrite((change, context) => {
  const walletId = context.params.walletId;
  console.log("walletUpdateQuotas -- START --", walletId);
  console.log("walletUpdateQuotas -- START --", COLLECTION_TRANSACTIONS, PATH_SEPARATOR, walletId);

  adminDB.ref(COLLECTION_WALLETS).child(walletId).child("quotas").once("value", (snap) => {
    return snap.val();
  }).then((value) => {
    console.log("quotas", value.val());
    const members = {};
    const memberKeys = [];
    for (const k in value.val()) {
      if (!Object.prototype.hasOwnProperty.call(value.val(), k)) continue;
      members[k] = new WalletMember(k, 0, 0, 0);
      if (!memberKeys.includes(k)) {
        memberKeys.push(k);
      }
    }
    adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).once("value", (snap) => {
      const trxList = snap.val();
      console.log("walletUpdateQuotas trxList:", JSON.stringify(trxList));
      const updates = {};
      let updatesMember = {};
      if (trxList === undefined || trxList === null) {
        updates["trxCount"] = 0;
      } else {
        const trxKeys = Object.keys(trxList);
        updates["trxCount"] = trxKeys.length;
        console.log("walletUpdateQuotas trxList:", trxKeys.length);
        updatesMember = walletQuotasCalculate(walletId, trxList, memberKeys);
      }

      for (const k in members) {
        if (!Object.prototype.hasOwnProperty.call(members, k)) continue;
        let memberValues = updatesMember[k];
        if (memberValues === undefined) {
          memberValues = members[k];
        }
        for (const f in memberValues) {
          if (Object.prototype.hasOwnProperty.call(memberValues, f)) {
            updates["quotas/" + k + "/" + f] = memberValues[f];
          }
        }
      }

      console.log("walletUpdateQuotas - updates", updates);
      adminDB.ref(COLLECTION_WALLETS).child(walletId).update(updates);
    });
  });

  return change.after.ref;
});

// NB: oggi si limita a loggare nome e membri del gruppo
exports.walletUpdateNotification = functions.database.ref("/lastEvents/{walletId}/{eventId}")
    .onCreate((snap, context) => {
      const walletId = context.params.walletId;
      console.log("walletUpdateNotification START", walletId);
      const newVal = snap.val();

      adminDB.ref(COLLECTION_WALLETS).child(walletId).once("value", (snap) => {
        const group = snap.val();
        const g_name = group.name;
        const g_members = group.quotas;
        console.log({g_name});
        console.log({g_members});
        console.log({"trxName": newVal.name});
      });
    });
