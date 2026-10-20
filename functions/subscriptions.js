"use strict";
/**
 * Cloud Functions dell'abbonamento Pro: verifica degli acquisti e notifiche di Apple e Google.
 * La logica sta in subscriptionService.js (testabile), qui ci sono solo il collegamento ai servizi reali e i trigger.
 *
 * Google Play: l'accesso all'API usa l'account di servizio con cui gira la funzione
 * (project-1647827934304323079@appspot.gserviceaccount.com), che va invitato in Play Console
 * (Utenti e autorizzazioni) con i permessi sulle versioni e sui dati finanziari di Splixy. Nessun secret da gestire.
 */
const fs = require("fs");
const path = require("path");
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const {SignedDataVerifier, Environment, VerificationException} = require("@apple/app-store-server-library");
const {androidpublisher} = require("@googleapis/androidpublisher");
const {GoogleAuth} = require("google-auth-library");
const logic = require("./subscriptionLogic");
const {createSubscriptionService, COLLECTION_SUBSCRIPTIONS} = require("./subscriptionService");

const adminDB = admin.database();

const dbAdapter = {
  get: async (p) => (await adminDB.ref(p).get()).val(),
  set: (p, value) => adminDB.ref(p).set(value),
  update: (updates) => adminDB.ref().update(updates),
  // uid -> scadenza degli abbonamenti attivi con scadenza fino a maxExpiryMs
  activeUntil: async (maxExpiryMs) => {
    const snap = await adminDB.ref("activeSubscriptions").orderByValue().endAt(maxExpiryMs).get();
    return snap.exists() ? snap.val() : {};
  },
};

let appleVerifiers = null;
/**
 * Verificatori Apple per Production e Sandbox, creati una volta per istanza della funzione.
 * @return {{production: SignedDataVerifier, sandbox: SignedDataVerifier}} verificatori
 */
function getAppleVerifiers() {
  if (appleVerifiers) return appleVerifiers;
  const rootCert = fs.readFileSync(path.join(__dirname, "certs", "AppleRootCA-G3.cer"));
  appleVerifiers = {
    production: new SignedDataVerifier([rootCert], true, Environment.PRODUCTION, logic.IOS_BUNDLE_ID,
        logic.APPLE_APP_STORE_ID),
    sandbox: new SignedDataVerifier([rootCert], true, Environment.SANDBOX, logic.IOS_BUNDLE_ID),
  };
  return appleVerifiers;
}

/**
 * Prova Production e poi Sandbox: la stessa funzione riceve gli acquisti di entrambi gli ambienti.
 * @param {function(SignedDataVerifier): Promise<object>} fn operazione da eseguire con il verificatore
 * @return {Promise<object>} risultato
 */
async function withAppleEnvironments(fn) {
  const {production, sandbox} = getAppleVerifiers();
  try {
    return await fn(production);
  } catch (err) {
    return await fn(sandbox);
  }
}

const appleAdapter = {
  verifyTransaction: (signed) => withAppleEnvironments((v) => v.verifyAndDecodeTransaction(signed)),
  verifyNotification: (signed) => withAppleEnvironments((v) => v.verifyAndDecodeNotification(signed)),
  decodeTransaction: (signed, environment) => {
    const {production, sandbox} = getAppleVerifiers();
    return (environment === "Sandbox" ? sandbox : production).verifyAndDecodeTransaction(signed);
  },
  isInvalid: (err) => err instanceof VerificationException,
};

let publisher = null;
/**
 * @return {object} client Android Publisher autenticato con le credenziali della funzione
 */
function getPublisher() {
  if (!publisher) {
    const auth = new GoogleAuth({scopes: ["https://www.googleapis.com/auth/androidpublisher"]});
    publisher = androidpublisher({version: "v3", auth});
  }
  return publisher;
}

const googleAdapter = {
  getSubscription: async (purchaseToken) => {
    const res = await getPublisher().purchases.subscriptionsv2.get({
      packageName: logic.ANDROID_PACKAGE_NAME,
      token: purchaseToken,
    });
    return res.data;
  },
  acknowledge: (productId, purchaseToken) => getPublisher().purchases.subscriptions.acknowledge({
    packageName: logic.ANDROID_PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
    requestBody: {},
  }),
  // token non valido o non trovato
  isInvalid: (err) => [400, 404, 410].includes(Number(err && (err.code || (err.response && err.response.status)))),
};

const service = createSubscriptionService({
  db: dbAdapter,
  apple: appleAdapter,
  google: googleAdapter,
  now: () => Date.now(),
  log: functions.logger,
});

/**
 * Il client scrive la transazione grezza in subscriptions/{uid}/{platform}/{purchaseId} dopo un acquisto o un
 * ripristino: qui viene verificata presso lo store e, se valida, si aggiorna users/{uid}/subData.
 * La piattaforma viene dal percorso, non dal contenuto, così un client non può dichiararne un'altra.
 */
exports.onPurchaseWrite = functions.database.ref(`/${COLLECTION_SUBSCRIPTIONS}/{uid}/{platform}/{purchaseId}`)
    .onWrite(async (change, context) => {
      if (!change.after.exists()) return null;
      const {uid, platform, purchaseId} = context.params;
      const result = await service.processPurchase({uid, platform, purchaseId, purchase: change.after.val()});
      functions.logger.info(`onPurchaseWrite ${uid}/${platform}/${purchaseId}: ${result.outcome}`);
      return null;
    });

/**
 * Webhook di App Store Server Notifications V2. Pubblico: la sicurezza viene dalla firma del payload, verificata
 * con il certificato radice Apple. Risponde sempre 200, altrimenti Apple ritenta all'infinito la stessa notifica.
 */
exports.appStoreNotifications = functions.https.onRequest(async (req, res) => {
  const signedPayload = req.body && req.body.signedPayload;
  if (req.method !== "POST" || !signedPayload) {
    res.status(400).send("Missing signedPayload");
    return;
  }
  try {
    const result = await service.handleAppleNotification(signedPayload);
    functions.logger.info(`appStoreNotifications: ${result.outcome}`);
    res.status(200).send("ok");
  } catch (err) {
    functions.logger.error("appStoreNotifications", err);
    res.status(200).send("error-logged");
  }
});

/**
 * Notifiche in tempo reale di Google Play (rinnovi, disdette, scadenze, rimborsi) via Pub/Sub.
 */
exports.playRtdn = functions.pubsub.topic(logic.PLAY_PUBSUB_TOPIC).onPublish(async (message) => {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
  } catch (err) {
    functions.logger.error("playRtdn: payload non valido", err);
    return null;
  }
  const result = await service.handlePlayNotification(payload);
  functions.logger.info(`playRtdn: ${result.outcome}`);
  return null;
});

/**
 * Ogni 24 ore: segna "expired" gli abbonamenti scaduti per cui non è arrivato nessun rinnovo.
 */
exports.expireSubscriptions = functions.pubsub.schedule("every 24 hours").onRun(async () => {
  const expired = await service.expireSubscriptions();
  functions.logger.info(`expireSubscriptions: scaduti ${expired}`);
  return null;
});
