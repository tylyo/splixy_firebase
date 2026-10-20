"use strict";
/**
 * Logica pura dell'abbonamento Pro: nessun accesso a database, rete o orologio (l'ora arriva dal chiamante).
 * Le funzioni con effetti collaterali stanno in subscriptions.js. Non viene ri-esportata da index.js.
 */
const crypto = require("crypto");

const IOS_BUNDLE_ID = "com.tylyodev.splixy";
const APPLE_APP_STORE_ID = 6449210549;
const ANDROID_PACKAGE_NAME = "com.tylyodev.splixy";
// Il topic deve coincidere con quello configurato in Play Console (Monetizzazione → Notifiche in tempo reale).
const PLAY_PUBSUB_TOPIC = "play-subscriptions";

// Un solo ruolo a pagamento. Gli id dei prodotti sono diversi per piattaforma e vivono qui, mai nei file di lingua.
const ROLE_FREE = "free";
const ROLE_PRO = "pro";
const PRODUCT_ROLES = {
  "splixy_monthly": ROLE_PRO, // iOS
  "splixy_monthly_01": ROLE_PRO, // Android
};
const PLATFORMS = ["ios", "android"];

/**
 * @param {string} productId id del prodotto sullo store
 * @return {string|null} ruolo assegnato, null se il prodotto non è conosciuto
 */
function roleForProduct(productId) {
  return Object.prototype.hasOwnProperty.call(PRODUCT_ROLES, productId) ? PRODUCT_ROLES[productId] : null;
}

/**
 * Chiave per l'indice purchaseIndex: Apple (originalTransactionId) e Google (purchaseToken) hanno formati
 * diversi e il token può contenere caratteri non ammessi come chiave del Realtime Database (es. il punto).
 * @param {string} platform ios | android
 * @param {string} id originalTransactionId o purchaseToken
 * @return {string} chiave sicura
 */
function indexKey(platform, id) {
  return `${platform}_${crypto.createHash("sha256").update(String(id)).digest("hex")}`;
}

/**
 * Stato normalizzato a partire da una transazione Apple già verificata e decodificata (StoreKit 2).
 * @param {object} tx transazione decodificata (productId, expiresDate, revocationDate, originalTransactionId)
 * @param {number} nowMs ora corrente in millisecondi
 * @return {{isActive: boolean, status: string, expiryMs: (number|null), txId: (string|null), productId: string}}
 */
function appleState(tx, nowMs) {
  const expiryMs = typeof tx.expiresDate === "number" ? Math.floor(tx.expiresDate) : null;
  const revoked = Boolean(tx.revocationDate);
  const isActive = !revoked && expiryMs !== null && expiryMs > nowMs;
  return {
    isActive,
    status: isActive ? "active" : "expired",
    expiryMs,
    txId: tx.originalTransactionId ? String(tx.originalTransactionId) : null,
    productId: tx.productId,
  };
}

// Stati di purchases.subscriptionsv2.get in cui l'utente ha ancora diritto all'accesso (fino a expiryTime):
// ACTIVE; CANCELED (disdetto ma pagato fino a fine periodo); IN_GRACE_PERIOD (pagamento fallito, accesso mantenuto).
const GOOGLE_ACCESS_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_CANCELED",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

/**
 * Stato normalizzato a partire dalla risposta di purchases.subscriptionsv2.get.
 * @param {object} data risposta dell'API (subscriptionState, lineItems[{productId, expiryTime}], ...)
 * @param {string} purchaseToken token dell'acquisto
 * @param {number} nowMs ora corrente in millisecondi
 * @return {{isActive: boolean, status: string, expiryMs: (number|null), txId: string, productId: (string|null),
 *   needsAck: boolean}}
 */
function googleState(data, purchaseToken, nowMs) {
  const line = Array.isArray(data.lineItems) && data.lineItems.length > 0 ? data.lineItems[0] : {};
  const parsed = line.expiryTime ? Date.parse(line.expiryTime) : NaN;
  const expiryMs = Number.isFinite(parsed) ? parsed : null;
  const isActive = GOOGLE_ACCESS_STATES.has(data.subscriptionState) && expiryMs !== null && expiryMs > nowMs;
  return {
    isActive,
    status: isActive ? "active" : "expired",
    expiryMs,
    txId: String(purchaseToken),
    productId: line.productId || null,
    needsAck: isActive && data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
  };
}

/**
 * Decide se uno stato appena verificato va scritto in users/{uid}/subData.
 * Regole:
 *  - stesso abbonamento (stesso txId): si aggiorna sempre (rinnovo, disdetta, rimborso);
 *  - abbonamento diverso: lo sostituisce solo se è attivo e dura più dell'attuale, così il ripristino di una
 *    vecchia transazione scaduta non cancella un abbonamento in corso.
 * @param {object|null} current subData attuale
 * @param {{isActive: boolean, expiryMs: (number|null), txId: (string|null)}} incoming stato appena verificato
 * @param {number} nowMs ora corrente in millisecondi
 * @return {boolean} true se va scritto
 */
function shouldWriteSubData(current, incoming, nowMs) {
  if (!current || !current.role || current.role === ROLE_FREE) return true;
  if (incoming.txId && current.txId && incoming.txId === current.txId) return true;
  const currentActive = current.status === "active" && typeof current.expireAt === "number" && current.expireAt > nowMs;
  if (!currentActive) return true;
  return Boolean(incoming.isActive) && (incoming.expiryMs || 0) > current.expireAt;
}

/**
 * Valore da scrivere in users/{uid}/subData (expireAt in millisecondi, verifiedAt in secondi: unità attese dal client).
 * @param {{isActive: boolean, status: string, expiryMs: (number|null), txId: (string|null)}} state stato verificato
 * @param {string} platform ios | android
 * @param {string|null} role ruolo del prodotto
 * @param {number} nowSec ora corrente in secondi
 * @return {object} snapshot dell'abbonamento
 */
function buildSubData(state, platform, role, nowSec) {
  return {
    status: state.status,
    platform,
    role: state.isActive && role ? role : ROLE_FREE,
    expireAt: state.expiryMs,
    txId: state.txId,
    verifiedAt: nowSec,
  };
}

/**
 * Etichetta breve di una notifica App Store Server V2, per i log.
 * @param {string} notificationType tipo
 * @param {string|undefined} subtype sottotipo
 * @return {string} descrizione
 */
function classifyAppleNotification(notificationType, subtype) {
  switch (notificationType) {
    case "SUBSCRIBED":
      return subtype === "RESUBSCRIBE" ? "riabbonamento" : "primo acquisto";
    case "DID_RENEW":
      return "rinnovo";
    case "DID_CHANGE_RENEWAL_STATUS":
      return subtype === "AUTO_RENEW_DISABLED" ? "disdetta (rinnovo automatico spento)" : "rinnovo automatico riattivato";
    case "DID_FAIL_TO_RENEW":
      return "rinnovo fallito";
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
      return "scaduto";
    case "REFUND":
    case "REVOKE":
      return "rimborsato o revocato";
    default:
      return "altro";
  }
}

/**
 * Estrae i dati utili da un messaggio Pub/Sub delle notifiche in tempo reale di Google Play.
 * @param {object} payload JSON già decodificato
 * @return {{kind: string, purchaseToken: (string|null), productId: (string|null)}}
 *   kind: subscription | voided | test | other
 */
function parsePlayNotification(payload) {
  if (payload && payload.subscriptionNotification) {
    const n = payload.subscriptionNotification;
    return {kind: "subscription", purchaseToken: n.purchaseToken || null, productId: n.subscriptionId || null};
  }
  if (payload && payload.voidedPurchaseNotification) {
    return {kind: "voided", purchaseToken: payload.voidedPurchaseNotification.purchaseToken || null, productId: null};
  }
  if (payload && payload.testNotification) return {kind: "test", purchaseToken: null, productId: null};
  return {kind: "other", purchaseToken: null, productId: null};
}

module.exports = {
  IOS_BUNDLE_ID,
  APPLE_APP_STORE_ID,
  ANDROID_PACKAGE_NAME,
  PLAY_PUBSUB_TOPIC,
  ROLE_FREE,
  ROLE_PRO,
  PRODUCT_ROLES,
  PLATFORMS,
  roleForProduct,
  indexKey,
  appleState,
  googleState,
  shouldWriteSubData,
  buildSubData,
  classifyAppleNotification,
  parsePlayNotification,
};
