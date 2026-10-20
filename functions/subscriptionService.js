"use strict";
/**
 * Flusso dell'abbonamento Pro: verifica degli acquisti, scrittura di users/{uid}/subData, notifiche degli store e
 * scadenze. Le dipendenze esterne (database, Apple, Google, orologio) vengono passate da fuori, così i test usano
 * sostituti. Le Cloud Functions che lo usano stanno in subscriptions.js. Non viene ri-esportata da index.js.
 *
 * Percorsi del database:
 *  - subscriptions/{uid}/{platform}/{purchaseId}   transazione grezza scritta dal client (innesca la verifica)
 *  - subscriptionVerifications/{uid}/{platform}/{purchaseId}   esito della verifica, solo server (idempotenza)
 *  - purchaseIndex/{indexKey}                      uid a cui appartiene un acquisto, solo server
 *  - activeSubscriptions/{uid}                     scadenza (ms) degli abbonamenti attivi, solo server
 *  - users/{uid}/subData                           stato letto dall'app
 *  - users/{uid}/sub/{platform}                    ruolo per piattaforma, letto da attilio_lib
 */
const logic = require("./subscriptionLogic");

const COLLECTION_USERS = "users";
const COLLECTION_SUBSCRIPTIONS = "subscriptions";
const COLLECTION_VERIFICATIONS = "subscriptionVerifications";
const COLLECTION_PURCHASE_INDEX = "purchaseIndex";
const COLLECTION_ACTIVE = "activeSubscriptions";
// Dopo la scadenza si attende un giorno prima di dichiarare "expired": il rinnovo può arrivare in ritardo.
const EXPIRE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{db: object, apple: object, google: object, now: function(): number, log: object}} deps dipendenze
 * @return {object} operazioni sull'abbonamento
 */
function createSubscriptionService({db, apple, google, now, log = console}) {
  /**
   * Scrive lo stato verificato (se va scritto) e tiene allineati ruolo per piattaforma e indici.
   * @param {{uid: string, platform: string, role: (string|null), state: object}} args
   * @return {Promise<string>} "applied" oppure "kept_current"
   */
  async function applyState({uid, platform, role, state}) {
    const nowMs = now();
    const updates = {};
    if (state.txId) updates[`${COLLECTION_PURCHASE_INDEX}/${logic.indexKey(platform, state.txId)}`] = uid;

    const current = await db.get(`${COLLECTION_USERS}/${uid}/subData`);
    const write = logic.shouldWriteSubData(current, state, nowMs);
    if (write) {
      updates[`${COLLECTION_USERS}/${uid}/subData`] = logic.buildSubData(state, platform, role, Math.floor(nowMs / 1000));
      updates[`${COLLECTION_USERS}/${uid}/sub/${platform}`] = state.isActive && role ? role : null;
      updates[`${COLLECTION_ACTIVE}/${uid}`] = state.isActive ? state.expiryMs : null;
    }
    if (Object.keys(updates).length > 0) await db.update(updates);
    return write ? "applied" : "kept_current";
  }

  /**
   * Verifica una transazione scritta dal client in subscriptions/{uid}/{platform}/{purchaseId}.
   * Gli errori transitori (rete, API) vengono rilanciati: la verifica si ripete alla prossima scrittura.
   * Gli acquisti non validi vengono registrati come "rejected" e non si ripetono.
   * @param {{uid: string, platform: string, purchaseId: string, purchase: object}} args
   * @return {Promise<{outcome: string}>} esito
   */
  async function processPurchase({uid, platform, purchaseId, purchase}) {
    if (!logic.PLATFORMS.includes(platform)) return {outcome: "ignored_platform"};
    if (!purchase || typeof purchase.productId !== "string" || typeof purchase.serverVerificationData !== "string" ||
        purchase.serverVerificationData === "") {
      return {outcome: "invalid_data"};
    }

    const verificationPath = `${COLLECTION_VERIFICATIONS}/${uid}/${platform}/${purchaseId}`;
    if (await db.get(verificationPath)) return {outcome: "already_verified"};

    const reject = async (reason) => {
      log.warn(`subscription: acquisto rifiutato (${reason}) ${uid}/${platform}/${purchaseId}`);
      await db.set(verificationPath, {status: "rejected", reason, at: Math.floor(now() / 1000)});
      return {outcome: "rejected", reason};
    };

    const role = logic.roleForProduct(purchase.productId);
    if (!role) return reject("unknown_product");

    let state;
    try {
      if (platform === "ios") {
        const tx = await apple.verifyTransaction(purchase.serverVerificationData);
        if (tx.productId !== purchase.productId) return reject("product_mismatch");
        state = logic.appleState(tx, now());
      } else {
        const data = await google.getSubscription(purchase.serverVerificationData);
        state = logic.googleState(data, purchase.serverVerificationData, now());
        if (state.productId !== purchase.productId) return reject("product_mismatch");
        if (state.needsAck) await google.acknowledge(purchase.productId, purchase.serverVerificationData);
      }
    } catch (err) {
      if (apple.isInvalid(err) || google.isInvalid(err)) return reject("invalid_purchase");
      throw err;
    }

    const outcome = await applyState({uid, platform, role, state});
    await db.set(verificationPath, {
      status: "verified",
      isActive: state.isActive,
      productId: purchase.productId,
      at: Math.floor(now() / 1000),
    });
    return {outcome, isActive: state.isActive};
  }

  /**
   * Notifica App Store Server V2 (rinnovi, disdette, rimborsi). Non solleva mai errori di dominio: la risposta
   * alla richiesta HTTP è comunque 200, altrimenti Apple ritenterebbe la stessa notifica.
   * @param {string} signedPayload payload firmato
   * @return {Promise<{outcome: string}>} esito
   */
  async function handleAppleNotification(signedPayload) {
    const decoded = await apple.verifyNotification(signedPayload);
    log.info(`appStoreNotifications: ${logic.classifyAppleNotification(decoded.notificationType, decoded.subtype)}` +
      ` (${decoded.notificationType}${decoded.subtype ? `/${decoded.subtype}` : ""})`);
    if (!decoded.data || !decoded.data.signedTransactionInfo) return {outcome: "no_transaction"};

    const tx = await apple.decodeTransaction(decoded.data.signedTransactionInfo, decoded.data.environment);
    const uid = await db.get(`${COLLECTION_PURCHASE_INDEX}/${logic.indexKey("ios", tx.originalTransactionId)}`);
    if (!uid) {
      log.warn(`appStoreNotifications: nessun utente per ${tx.originalTransactionId}`);
      return {outcome: "unknown_user"};
    }
    const role = logic.roleForProduct(tx.productId);
    if (!role) return {outcome: "unknown_product"};
    return {outcome: await applyState({uid, platform: "ios", role, state: logic.appleState(tx, now())})};
  }

  /**
   * Notifica in tempo reale di Google Play (messaggio Pub/Sub già decodificato).
   * @param {object} payload JSON della notifica
   * @return {Promise<{outcome: string}>} esito
   */
  async function handlePlayNotification(payload) {
    const n = logic.parsePlayNotification(payload);
    if (n.kind === "test" || n.kind === "other" || !n.purchaseToken) return {outcome: "ignored"};

    const uid = await db.get(`${COLLECTION_PURCHASE_INDEX}/${logic.indexKey("android", n.purchaseToken)}`);
    if (!uid) {
      log.warn("playRtdn: nessun utente per il token ricevuto");
      return {outcome: "unknown_user"};
    }
    const data = await google.getSubscription(n.purchaseToken);
    const state = logic.googleState(data, n.purchaseToken, now());
    if (n.kind === "voided") {
      state.isActive = false;
      state.status = "expired";
    }
    const role = logic.roleForProduct(state.productId || n.productId);
    if (!role) return {outcome: "unknown_product"};
    return {outcome: await applyState({uid, platform: "android", role, state})};
  }

  /**
   * Segna "expired" gli abbonamenti la cui scadenza è passata da più di EXPIRE_GRACE_MS e per cui non è
   * arrivato nessun rinnovo. Rete di sicurezza: l'app considera già scaduto chi ha expireAt nel passato.
   * @return {Promise<number>} abbonamenti scaduti
   */
  async function expireSubscriptions() {
    const nowMs = now();
    const due = await db.activeUntil(nowMs - EXPIRE_GRACE_MS);
    let expired = 0;
    for (const uid of Object.keys(due)) {
      const subData = await db.get(`${COLLECTION_USERS}/${uid}/subData`);
      const updates = {[`${COLLECTION_ACTIVE}/${uid}`]: null};
      if (subData && subData.status === "active" && typeof subData.expireAt === "number" &&
          subData.expireAt <= nowMs - EXPIRE_GRACE_MS) {
        updates[`${COLLECTION_USERS}/${uid}/subData/status`] = "expired";
        updates[`${COLLECTION_USERS}/${uid}/subData/role`] = logic.ROLE_FREE;
        updates[`${COLLECTION_USERS}/${uid}/subData/verifiedAt`] = Math.floor(nowMs / 1000);
        if (subData.platform) updates[`${COLLECTION_USERS}/${uid}/sub/${subData.platform}`] = null;
        expired++;
      }
      await db.update(updates);
    }
    return expired;
  }

  return {applyState, processPurchase, handleAppleNotification, handlePlayNotification, expireSubscriptions};
}

module.exports = {createSubscriptionService, COLLECTION_SUBSCRIPTIONS};
