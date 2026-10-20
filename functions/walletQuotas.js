"use strict";
/**
 * Aggiornamento delle quote del wallet nel database (parte con effetti collaterali).
 */
const admin = require("firebase-admin");
const adminDB = admin.database();
const {
  COLLECTION_WALLETS,
  COLLECTION_TRANSACTIONS,
  currentTM,
} = require("./commons");
const {WalletMember, trxFromSnap} = require("./models");
const {calculate} = require("./calculations");
const {sendNotification} = require("./notifications");

/**
 * Ricalcola da zero le quote di tutti i membri a partire dalla lista delle transazioni.
 * Se la quota base registrata in una transazione è diversa da quella calcolata la corregge.
 * @param {string} walletId id del wallet
 * @param {object} trxList transazioni (id -> valore RTDB)
 * @param {Array} memberKeys id dei membri (non usato nel calcolo)
 * @return {object} membro -> {p, s, m, q, trxc}
 */
function walletQuotasCalculate(walletId, trxList, memberKeys) {
  const updatesMember = {};
  console.log("walletQuotasCalculate - START");
  for (const trxId in trxList) {
    if (!Object.prototype.hasOwnProperty.call(trxList, trxId)) continue;
    const nextTrx = trxFromSnap(trxList[trxId], trxId);

    const calcolo = calculate(nextTrx);
    if (calcolo.quota > 0) {
      adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).child(trxId).child("q/a").set(calcolo.quota);
    }
    const nextCalc = calcolo.walletUPD;

    for (const key in nextCalc) {
      if (!Object.prototype.hasOwnProperty.call(nextCalc, key)) continue;
      let prevCalc = new WalletMember(key, 0, 0, 0, 0);
      if (Object.prototype.hasOwnProperty.call(updatesMember, key)) {
        prevCalc = updatesMember[key];
      }

      const paid = prevCalc.p + nextCalc[key].p;
      const debt = prevCalc.s + nextCalc[key].s;
      const move = prevCalc.m + nextCalc[key].m;
      const trxc = prevCalc.trxc + 1;

      const member = new WalletMember(key, paid, debt, move, trxc);
      updatesMember[key] = member.toMap();
    }
  }
  return updatesMember;
}

/**
 * Applica al wallet le variazioni delle quote di una transazione, aggiorna il contatore delle
 * transazioni e notifica gli altri membri.
 * @param {string} walletId id del wallet
 * @param {object} nextMembers membro -> variazioni (WalletMember)
 * @param {number} delta variazione del numero di transazioni (+1, -1, 0)
 * @param {LastEvent} lastEvent evento da notificare
 */
function updateWalletQuotaLast(walletId, nextMembers, delta = 0, lastEvent = {}) {
  adminDB.ref(COLLECTION_WALLETS).child(walletId).once("value", (snap) => {
    console.group("updateWalletQuotaLast", walletId);
    const walletMap = snap.val();
    const currMembers = walletMap["quotas"];

    let trxCount = 0;
    const walletKeys = Object.keys(walletMap);
    console.log("walletKeys: " + walletKeys.includes("trxCount"));
    if (walletKeys.includes("trxCount")) {
      trxCount = walletMap["trxCount"];
    }

    const finalMemberUpdates = {};
    let users = [];

    for (const key in currMembers) {
      if (!Object.prototype.hasOwnProperty.call(currMembers, key)) continue;
      const prefix = "quotas/" + key;
      const currM = currMembers[key];
      const nextM = nextMembers[key];
      console.log("updateWalletQuotaLast LOOP next", key, currM, "->", nextM);
      if (currM.trxc === undefined) {
        currM.trxc = 0;
      }
      if (nextM !== undefined) {
        finalMemberUpdates[prefix + "/p"] = currM.p + nextM.p;
        finalMemberUpdates[prefix + "/s"] = currM.s + nextM.s;
        finalMemberUpdates[prefix + "/q"] = currM.q + nextM.q;
        finalMemberUpdates[prefix + "/m"] = currM.m + nextM.m;
        finalMemberUpdates[prefix + "/trxc"] = currM.trxc + nextM.trxc;
      } else {
        finalMemberUpdates[prefix + "/p"] = currM.p;
        finalMemberUpdates[prefix + "/s"] = currM.s;
        finalMemberUpdates[prefix + "/q"] = currM.q;
        finalMemberUpdates[prefix + "/m"] = currM.m;
        finalMemberUpdates[prefix + "/trxc"] = currM.trxc;
      }
      if (currM["user"] !== undefined) {
        users.push(currM["user"]);
      }
    }
    if (delta != 0) {
      finalMemberUpdates["trxCount"] = trxCount + delta;
    }

    finalMemberUpdates["updated"] = currentTM();
    if (lastEvent !== undefined) {
      // NB: LastEvent salva l'autore in "u", non in "user": questo filtro quindi non esclude nessuno
      users = users.filter((elem) => {
        return elem !== lastEvent["user"];
      });
      lastEvent["gnm"] = walletMap["name"];
      lastEvent["gid"] = snap.key;
      sendNotification(users, "en", lastEvent);
    }
    console.groupEnd();
    snap.ref.update(finalMemberUpdates);
  });
}

module.exports = {walletQuotasCalculate, updateWalletQuotaLast};
