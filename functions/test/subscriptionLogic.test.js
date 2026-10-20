"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const L = require("../subscriptionLogic");

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 86400000;

describe("roleForProduct", () => {
  it("riconosce i due prodotti mensili e rifiuta gli altri", () => {
    assert.equal(L.roleForProduct("splixy_monthly"), "pro");
    assert.equal(L.roleForProduct("splixy_monthly_01"), "pro");
    assert.equal(L.roleForProduct("splixy-monthly-01"), null);
    assert.equal(L.roleForProduct("constructor"), null);
    assert.equal(L.roleForProduct(undefined), null);
  });
});

describe("indexKey", () => {
  it("è deterministico, distingue le piattaforme e non contiene caratteri vietati nelle chiavi RTDB", () => {
    const k = L.indexKey("android", "abc.def-ghi_jkl$#[]/");
    assert.equal(k, L.indexKey("android", "abc.def-ghi_jkl$#[]/"));
    assert.notEqual(k, L.indexKey("ios", "abc.def-ghi_jkl$#[]/"));
    assert.match(k, /^android_[0-9a-f]{64}$/);
  });
});

describe("appleState", () => {
  it("attivo se non revocato e con scadenza futura", () => {
    const s = L.appleState({productId: "p", expiresDate: NOW + DAY, originalTransactionId: 123}, NOW);
    assert.deepEqual(s, {isActive: true, status: "active", expiryMs: NOW + DAY, txId: "123", productId: "p"});
  });
  it("scaduto se la scadenza è passata", () => {
    assert.equal(L.appleState({productId: "p", expiresDate: NOW - 1, originalTransactionId: 1}, NOW).isActive, false);
  });
  it("revocato (rimborso) anche con scadenza futura", () => {
    const s = L.appleState({productId: "p", expiresDate: NOW + DAY, revocationDate: NOW - DAY}, NOW);
    assert.equal(s.isActive, false);
    assert.equal(s.status, "expired");
  });
  it("senza data di scadenza non è attivo", () => {
    assert.equal(L.appleState({productId: "p"}, NOW).isActive, false);
  });
});

describe("googleState", () => {
  const data = (state, expiry, extra = {}) => ({
    subscriptionState: state,
    lineItems: [{productId: "splixy_monthly_01", expiryTime: new Date(expiry).toISOString()}],
    ...extra,
  });
  it("attivo", () => {
    const s = L.googleState(data("SUBSCRIPTION_STATE_ACTIVE", NOW + DAY), "tok", NOW);
    assert.equal(s.isActive, true);
    assert.equal(s.expiryMs, NOW + DAY);
    assert.equal(s.productId, "splixy_monthly_01");
    assert.equal(s.txId, "tok");
  });
  it("disdetto ma ancora pagato conserva l'accesso fino alla scadenza", () => {
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_CANCELED", NOW + DAY), "t", NOW).isActive, true);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_CANCELED", NOW - DAY), "t", NOW).isActive, false);
  });
  it("periodo di tolleranza mantiene l'accesso, sospeso e in attesa no", () => {
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_IN_GRACE_PERIOD", NOW + DAY), "t", NOW).isActive, true);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_ON_HOLD", NOW + DAY), "t", NOW).isActive, false);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_PENDING", NOW + DAY), "t", NOW).isActive, false);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_EXPIRED", NOW - DAY), "t", NOW).isActive, false);
  });
  it("chiede il riconoscimento (acknowledge) solo se attivo e non ancora riconosciuto", () => {
    const pending = {acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING"};
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_ACTIVE", NOW + DAY, pending), "t", NOW).needsAck, true);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_ACTIVE", NOW + DAY), "t", NOW).needsAck, false);
    assert.equal(L.googleState(data("SUBSCRIPTION_STATE_EXPIRED", NOW - DAY, pending), "t", NOW).needsAck, false);
  });
  it("risposta senza righe non solleva errori", () => {
    const s = L.googleState({subscriptionState: "SUBSCRIPTION_STATE_ACTIVE"}, "t", NOW);
    assert.equal(s.isActive, false);
    assert.equal(s.expiryMs, null);
  });
});

describe("shouldWriteSubData", () => {
  const active = {role: "pro", status: "active", expireAt: NOW + 10 * DAY, txId: "A"};
  const inc = (over) => ({isActive: true, expiryMs: NOW + 40 * DAY, txId: "B", ...over});

  it("scrive se non c'è nulla o l'utente è free", () => {
    assert.equal(L.shouldWriteSubData(null, inc(), NOW), true);
    assert.equal(L.shouldWriteSubData({role: "free"}, inc(), NOW), true);
  });
  it("aggiorna sempre lo stesso abbonamento, anche per disdetta o rimborso", () => {
    assert.equal(L.shouldWriteSubData(active, inc({txId: "A", isActive: false, expiryMs: NOW - 1}), NOW), true);
    assert.equal(L.shouldWriteSubData(active, inc({txId: "A", expiryMs: NOW + 40 * DAY}), NOW), true);
  });
  it("un'altra transazione scaduta non cancella un abbonamento in corso", () => {
    assert.equal(L.shouldWriteSubData(active, inc({isActive: false, expiryMs: NOW - DAY}), NOW), false);
  });
  it("un'altra transazione attiva sostituisce solo se dura di più", () => {
    assert.equal(L.shouldWriteSubData(active, inc({expiryMs: NOW + 40 * DAY}), NOW), true);
    assert.equal(L.shouldWriteSubData(active, inc({expiryMs: NOW + 5 * DAY}), NOW), false);
  });
  it("se quello attuale è già scaduto lo sostituisce", () => {
    const expired = {role: "pro", status: "active", expireAt: NOW - DAY, txId: "A"};
    assert.equal(L.shouldWriteSubData(expired, inc({isActive: false, expiryMs: NOW - 2 * DAY}), NOW), true);
  });
});

describe("buildSubData", () => {
  it("usa millisecondi per la scadenza e secondi per verifiedAt", () => {
    const d = L.buildSubData({isActive: true, status: "active", expiryMs: NOW + DAY, txId: "A"}, "ios", "pro", 1000);
    assert.deepEqual(d, {status: "active", platform: "ios", role: "pro", expireAt: NOW + DAY, txId: "A", verifiedAt: 1000});
  });
  it("un abbonamento non attivo torna al ruolo free", () => {
    const d = L.buildSubData({isActive: false, status: "expired", expiryMs: NOW - 1, txId: "A"}, "android", "pro", 1);
    assert.equal(d.role, "free");
    assert.equal(d.status, "expired");
  });
});

describe("parsePlayNotification", () => {
  it("riconosce i tipi di messaggio", () => {
    assert.deepEqual(L.parsePlayNotification({subscriptionNotification: {purchaseToken: "t", subscriptionId: "s"}}),
        {kind: "subscription", purchaseToken: "t", productId: "s"});
    assert.equal(L.parsePlayNotification({voidedPurchaseNotification: {purchaseToken: "t"}}).kind, "voided");
    assert.equal(L.parsePlayNotification({testNotification: {}}).kind, "test");
    assert.equal(L.parsePlayNotification({}).kind, "other");
    assert.equal(L.parsePlayNotification(null).kind, "other");
  });
});

describe("classifyAppleNotification", () => {
  it("distingue primo acquisto, rinnovo, disdetta e rimborso", () => {
    assert.equal(L.classifyAppleNotification("SUBSCRIBED", undefined), "primo acquisto");
    assert.equal(L.classifyAppleNotification("SUBSCRIBED", "RESUBSCRIBE"), "riabbonamento");
    assert.equal(L.classifyAppleNotification("DID_RENEW"), "rinnovo");
    assert.match(L.classifyAppleNotification("DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED"), /disdetta/);
    assert.equal(L.classifyAppleNotification("REFUND"), "rimborsato o revocato");
    assert.equal(L.classifyAppleNotification("XYZ"), "altro");
  });
});

describe("purchaseIndexKeysOf", () => {
  const logic = require("../subscriptionLogic");
  const assert = require("assert");

  it("raccoglie le chiavi dagli esiti di verifica e dall'ultimo subData, senza doppioni", () => {
    const keys = logic.purchaseIndexKeysOf(
        {ios: {a: {txId: "100"}, b: {txId: "100"}}, android: {c: {txId: "tok"}, d: {status: "rejected"}}},
        {platform: "android", txId: "tok2"},
    );
    assert.deepStrictEqual(keys.sort(), [
      logic.indexKey("android", "tok"),
      logic.indexKey("android", "tok2"),
      logic.indexKey("ios", "100"),
    ].sort());
  });

  it("senza dati non restituisce nulla", () => {
    assert.deepStrictEqual(logic.purchaseIndexKeysOf(null, null), []);
    assert.deepStrictEqual(logic.purchaseIndexKeysOf({}, {platform: "web", txId: "x"}), []);
  });
});
