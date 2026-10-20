"use strict";
/**
 * Gestione dei partecipanti rispetto alle transazioni esistenti.
 */
const functions = require("firebase-functions/v1");
const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const adminDB = admin.database();
const {
  COLLECTION_TRANSACTIONS,
  COLLECTION_WALLETS,
  PATH_SEPARATOR,
  currentTM,
} = require("./commons");
const {trxFromSnap} = require("./models");

/**
 * Quando un partecipante viene rimosso dal wallet lo toglie da tutte le transazioni
 * e chiede il ricalcolo delle quote (updQuota).
 */
exports.memberRemove = functions.database.ref("/wallets/{walletId}/quotas/{memberId}")
    .onDelete(async (snap, context) => {
      const walletId = context.params.walletId;
      const memberId = context.params.memberId;

      const LOG_PREFIX = "removeMember[" + walletId + PATH_SEPARATOR + memberId + "] ";
      console.log(LOG_PREFIX);

      const trxListSnap = (await adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).get());
      if (trxListSnap != null && trxListSnap !== undefined) {
        const trxList = trxListSnap.val();
        const trxUpdates = new Map();
        for (const trxId in trxList) {
          if (!Object.prototype.hasOwnProperty.call(trxList, trxId)) continue;
          const nextTrx = trxFromSnap(trxList[trxId], trxId);
          console.log("trx" + PATH_SEPARATOR + trxId + ":" + JSON.stringify(nextTrx.debs));
          const trxQuotaKeys = Object.keys(nextTrx.debs);
          if (trxQuotaKeys !== undefined && trxQuotaKeys.includes(memberId)) {
            const deletepath = [trxId, "debs", memberId].join(PATH_SEPARATOR);
            console.log(LOG_PREFIX + ": > " + deletepath);
            trxUpdates[deletepath] = null;
            console.log(LOG_PREFIX + ": " + JSON.stringify(trxUpdates));
          }
        }
        const toDeleteKeys = Object.keys(trxUpdates);
        console.log(LOG_PREFIX + ":" + JSON.stringify(toDeleteKeys.length));
        if (toDeleteKeys.length > 0) {
          const deletepath = [COLLECTION_TRANSACTIONS, walletId].join(PATH_SEPARATOR);
          console.log(LOG_PREFIX + ":" + deletepath + "-" + JSON.stringify(trxUpdates));
          await adminDB.ref(deletepath).update(trxUpdates);
          await adminDB.ref(COLLECTION_WALLETS).child(walletId).child("updQuota").set(currentTM());
        }
      }
    });

/**
 * Callable: aggiunge un partecipante (con n parti) a tutte le transazioni del wallet.
 * Parametri: w = wallet, m = membro, n = parti.
 */
exports.memberAddToAll = onCall(async (req) => {
  const walletId = req.data["w"];
  const memberId = req.data["m"];
  const parts = req.data["n"];

  const LOG_PREFIX = "memberAddToAll[" + walletId + PATH_SEPARATOR + memberId + PATH_SEPARATOR + parts + "] ";

  console.log(LOG_PREFIX + "auth " + JSON.stringify(req.auth));

  const trxListSnap = (await adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).get());
  if (trxListSnap != null && trxListSnap !== undefined) {
    const trxList = trxListSnap.val();
    const trxUpdates = new Map();
    for (const trxId in trxList) {
      if (!Object.prototype.hasOwnProperty.call(trxList, trxId)) continue;
      const nextTrx = trxFromSnap(trxList[trxId], trxId);
      console.log("trx" + PATH_SEPARATOR + trxId + ":" + JSON.stringify(nextTrx.debs[memberId]));
      const trxQuotaKeys = Object.keys(nextTrx.debs);

      if (trxQuotaKeys !== undefined && trxQuotaKeys.includes(memberId) && nextTrx.debs[memberId] == parts) {
        continue;
      }

      const updatePath = [trxId, "debs", memberId].join(PATH_SEPARATOR);
      trxUpdates[updatePath] = parts;
    }
    const updatesKeys = Object.keys(trxUpdates);

    console.log(LOG_PREFIX + " - tot:" + JSON.stringify(updatesKeys.length));
    if (updatesKeys.length > 0) {
      const updatePath = [COLLECTION_TRANSACTIONS, walletId].join(PATH_SEPARATOR);
      console.log(LOG_PREFIX + ":" + updatePath + "-" + JSON.stringify(trxUpdates));
      await adminDB.ref(updatePath).update(trxUpdates);
      await adminDB.ref(COLLECTION_WALLETS).child(walletId).child("updQuota").set(currentTM());
    }
  }

  return {"status": "ok"};
});
