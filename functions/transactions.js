"use strict";
/**
 * Trigger sulle transazioni: ogni creazione/modifica/cancellazione aggiorna le quote del wallet
 * e notifica gli altri membri.
 */
const functions = require("firebase-functions/v1");
const {LastEvent, trxFromSnap} = require("./models");
const {calculate, trxUpdateToWallet} = require("./calculations");
const {updateWalletQuotaLast} = require("./walletQuotas");

exports.trxUpdate = functions.database.ref("/transactions/{walletId}/{trxId}").onUpdate((snap, context) => {
  console.log("trxUpdate", "START");
  const walletId = context.params.walletId;
  const trx_id = context.params.trxId;
  const user_id = context.auth?.token.user_id;

  const before = snap.before.val();
  const updated = snap.after.val();
  const currTrx = trxFromSnap(before, snap.key);
  const nextTrx = trxFromSnap(updated, snap.key);

  const updatesMember = trxUpdateToWallet(walletId, currTrx, nextTrx);
  const lastEvent = new LastEvent("trxUpd", trx_id, updated["name"], user_id);

  updateWalletQuotaLast(walletId, updatesMember, 0, lastEvent);

  return snap;
});

exports.trxDelete = functions.database.ref("/transactions/{walletId}/{trxId}").onDelete((snap, context) => {
  const _walletId = context.params.walletId;
  const trx_id = context.params.trxId;
  const user_id = context.auth?.token.user_id;

  const trx = trxFromSnap(snap.val());
  const updates = calculate(trx).walletUPD;
  const finalupdates = {};
  for (const key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      finalupdates[key] = updates[key].subtract();
    }
  }
  const lastEvent = new LastEvent("trxDel", trx_id, trx.nm, user_id);
  lastEvent.extra = snap.val();
  updateWalletQuotaLast(_walletId, finalupdates, -1, lastEvent);
  return snap;
});

exports.trxCreate = functions.database.ref("/transactions/{walletId}/{trxId}").onCreate((snap, context) => {
  const _walletId = context.params.walletId;
  const trx_id = context.params.trxId;
  const user_id = context.auth?.token.user_id;
  const newKey = snap.key;
  const newVal = snap.val();

  const newTrx = trxFromSnap(newVal, newKey);
  const res = calculate(newTrx);

  const lastEvent = new LastEvent("trxAdd", trx_id, newTrx.nm, user_id);

  updateWalletQuotaLast(_walletId, res.walletUPD, 1, lastEvent);

  return snap;
});
