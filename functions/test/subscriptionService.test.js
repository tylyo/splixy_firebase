"use strict";

const {describe, it, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const {createSubscriptionService} = require("../subscriptionService");
const L = require("../subscriptionLogic");

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 86400000;

/** Database finto: albero in memoria con percorsi "a/b/c", update multi-percorso (null = elimina). */
function fakeDb() {
  const tree = {};
  const parts = (p) => p.split("/").filter(Boolean);
  const getNode = (p) => parts(p).reduce((n, k) => (n === undefined || n === null ? undefined : n[k]), tree);
  const setNode = (p, value) => {
    const ks = parts(p);
    let n = tree;
    ks.slice(0, -1).forEach((k) => {
      if (typeof n[k] !== "object" || n[k] === null) n[k] = {};
      n = n[k];
    });
    if (value === null || value === undefined) delete n[ks[ks.length - 1]];
    else n[ks[ks.length - 1]] = JSON.parse(JSON.stringify(value));
    prune(tree);
  };
  // come nel Realtime Database, un nodo senza figli non esiste
  const prune = (node) => {
    Object.keys(node).forEach((k) => {
      if (typeof node[k] === "object" && node[k] !== null) {
        prune(node[k]);
        if (Object.keys(node[k]).length === 0) delete node[k];
      }
    });
  };
  return {
    tree,
    get: async (p) => {
      const v = getNode(p);
      return v === undefined ? null : JSON.parse(JSON.stringify(v));
    },
    set: async (p, v) => setNode(p, v),
    update: async (u) => Object.entries(u).forEach(([p, v]) => setNode(p, v)),
    activeUntil: async (max) => {
      const all = tree.activeSubscriptions || {};
      return Object.fromEntries(Object.entries(all).filter(([, exp]) => exp <= max));
    },
  };
}

describe("subscriptionService", () => {
  let db; let calls; let clock; let apple; let google; let svc;
  const InvalidSig = class extends Error {};

  beforeEach(() => {
    db = fakeDb();
    calls = {ack: [], googleGets: 0};
    clock = NOW;
    apple = {
      tx: {productId: "splixy_monthly", expiresDate: NOW + 30 * DAY, originalTransactionId: "1000"},
      verifyTransaction: async (signed) => {
        if (signed === "BAD") throw new InvalidSig("firma non valida");
        if (signed === "NET") throw new Error("rete");
        return apple.tx;
      },
      verifyNotification: async () => apple.notification,
      decodeTransaction: async () => apple.tx,
      isInvalid: (e) => e instanceof InvalidSig,
      notification: null,
    };
    google = {
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        lineItems: [{productId: "splixy_monthly_01", expiryTime: new Date(NOW + 30 * DAY).toISOString()}],
      },
      getSubscription: async () => {
        calls.googleGets++;
        return google.data;
      },
      acknowledge: async (p, t) => calls.ack.push([p, t]),
      isInvalid: () => false,
    };
    svc = createSubscriptionService({db, apple, google, now: () => clock, log: {info() {}, warn() {}, error() {}}});
  });

  const iosPurchase = (over = {}) => ({productId: "splixy_monthly", serverVerificationData: "SIGNED", ...over});
  const run = (platform, purchase, id = "p1") => svc.processPurchase({uid: "u1", platform, purchaseId: id, purchase});

  describe("processPurchase", () => {
    it("iOS valido: scrive subData, ruolo per piattaforma, indici e esito", async () => {
      const r = await run("ios", iosPurchase());
      assert.equal(r.outcome, "applied");
      assert.deepEqual(db.tree.users.u1.subData, {
        status: "active", platform: "ios", role: "pro", expireAt: NOW + 30 * DAY, txId: "1000", verifiedAt: NOW / 1000,
      });
      assert.equal(db.tree.users.u1.sub.ios, "pro");
      assert.equal(db.tree.purchaseIndex[L.indexKey("ios", "1000")], "u1");
      assert.equal(db.tree.activeSubscriptions.u1, NOW + 30 * DAY);
      assert.equal(db.tree.subscriptionVerifications.u1.ios.p1.status, "verified");
    });

    it("Android valido: riconosce l'acquisto (acknowledge) e usa il token come identificativo", async () => {
      const r = await run("android", {productId: "splixy_monthly_01", serverVerificationData: "TOKEN.1-2"});
      assert.equal(r.outcome, "applied");
      assert.deepEqual(calls.ack, [["splixy_monthly_01", "TOKEN.1-2"]]);
      assert.equal(db.tree.users.u1.subData.platform, "android");
      assert.equal(db.tree.purchaseIndex[L.indexKey("android", "TOKEN.1-2")], "u1");
    });

    it("non richiama lo store se la transazione è già stata verificata", async () => {
      await run("android", {productId: "splixy_monthly_01", serverVerificationData: "T"});
      await run("android", {productId: "splixy_monthly_01", serverVerificationData: "T"});
      assert.equal(calls.googleGets, 1);
    });

    it("prodotto sconosciuto: rifiutato e registrato, senza toccare subData", async () => {
      const r = await run("ios", iosPurchase({productId: "altro"}));
      assert.deepEqual([r.outcome, r.reason], ["rejected", "unknown_product"]);
      assert.equal(db.tree.users, undefined);
      assert.equal(db.tree.subscriptionVerifications.u1.ios.p1.status, "rejected");
    });

    it("prodotto diverso da quello nella transazione firmata: rifiutato", async () => {
      apple.tx = {...apple.tx, productId: "splixy_monthly_01"};
      const r = await run("ios", iosPurchase());
      assert.equal(r.reason, "product_mismatch");
      assert.equal(db.tree.users, undefined);
    });

    it("firma non valida: rifiutato e non si ripete", async () => {
      const r = await run("ios", iosPurchase({serverVerificationData: "BAD"}));
      assert.equal(r.reason, "invalid_purchase");
      assert.equal((await run("ios", iosPurchase({serverVerificationData: "BAD"}))).outcome, "already_verified");
    });

    it("errore di rete: viene rilanciato e non si registra nulla, così si può riprovare", async () => {
      await assert.rejects(run("ios", iosPurchase({serverVerificationData: "NET"})), /rete/);
      assert.equal(db.tree.subscriptionVerifications, undefined);
    });

    it("dati incompleti o piattaforma sconosciuta vengono ignorati", async () => {
      assert.equal((await run("ios", {productId: "splixy_monthly"})).outcome, "invalid_data");
      assert.equal((await run("windows", iosPurchase())).outcome, "ignored_platform");
      assert.equal((await run("ios", null)).outcome, "invalid_data");
    });

    it("il ripristino di una vecchia transazione scaduta non cancella l'abbonamento in corso", async () => {
      await run("ios", iosPurchase(), "new");
      apple.tx = {productId: "splixy_monthly", expiresDate: NOW - 60 * DAY, originalTransactionId: "OLD"};
      const r = await run("ios", iosPurchase({serverVerificationData: "OLD"}), "old");
      assert.equal(r.outcome, "kept_current");
      assert.equal(db.tree.users.u1.subData.status, "active");
      assert.equal(db.tree.users.u1.subData.txId, "1000");
    });

    it("transazione scaduta senza altro abbonamento: subData scade, ruolo free", async () => {
      apple.tx = {...apple.tx, expiresDate: NOW - DAY};
      await run("ios", iosPurchase());
      assert.equal(db.tree.users.u1.subData.status, "expired");
      assert.equal(db.tree.users.u1.subData.role, "free");
      assert.equal(db.tree.users.u1.sub, undefined);
      assert.equal(db.tree.activeSubscriptions, undefined);
    });
  });

  describe("handleAppleNotification", () => {
    beforeEach(async () => {
      await run("ios", iosPurchase());
      apple.notification = {notificationType: "DID_RENEW", data: {signedTransactionInfo: "S", environment: "Production"}};
    });

    it("rinnovo: estende la scadenza dell'utente giusto (grazie all'indice)", async () => {
      apple.tx = {...apple.tx, expiresDate: NOW + 60 * DAY};
      const r = await svc.handleAppleNotification("payload");
      assert.equal(r.outcome, "applied");
      assert.equal(db.tree.users.u1.subData.expireAt, NOW + 60 * DAY);
    });

    it("rimborso: l'abbonamento torna free", async () => {
      apple.notification = {notificationType: "REFUND", data: {signedTransactionInfo: "S", environment: "Production"}};
      apple.tx = {...apple.tx, revocationDate: NOW};
      await svc.handleAppleNotification("payload");
      assert.equal(db.tree.users.u1.subData.role, "free");
      assert.equal(db.tree.users.u1.sub, undefined);
    });

    it("transazione sconosciuta o notifica senza dati: nessun effetto", async () => {
      apple.tx = {...apple.tx, originalTransactionId: "9999"};
      assert.equal((await svc.handleAppleNotification("p")).outcome, "unknown_user");
      apple.notification = {notificationType: "TEST"};
      assert.equal((await svc.handleAppleNotification("p")).outcome, "no_transaction");
    });
  });

  describe("handlePlayNotification", () => {
    const msg = (kind = "subscriptionNotification") => ({[kind]: {purchaseToken: "TOK", subscriptionId: "splixy_monthly_01"}});
    beforeEach(async () => {
      await run("android", {productId: "splixy_monthly_01", serverVerificationData: "TOK"});
    });

    it("rinnovo: aggiorna subData e la scadenza", async () => {
      google.data = {...google.data, lineItems: [{productId: "splixy_monthly_01", expiryTime: new Date(NOW + 60 * DAY).toISOString()}]};
      assert.equal((await svc.handlePlayNotification(msg())).outcome, "applied");
      assert.equal(db.tree.users.u1.subData.expireAt, NOW + 60 * DAY);
    });

    it("acquisto annullato (rimborso): perde Pro anche se Play lo mostra ancora attivo", async () => {
      await svc.handlePlayNotification(msg("voidedPurchaseNotification"));
      assert.equal(db.tree.users.u1.subData.status, "expired");
      assert.equal(db.tree.users.u1.subData.role, "free");
    });

    it("token sconosciuto, test e altri messaggi vengono ignorati", async () => {
      assert.equal((await svc.handlePlayNotification({subscriptionNotification: {purchaseToken: "X", subscriptionId: "s"}})).outcome, "unknown_user");
      assert.equal((await svc.handlePlayNotification({testNotification: {}})).outcome, "ignored");
      assert.equal((await svc.handlePlayNotification({})).outcome, "ignored");
    });
  });

  describe("expireSubscriptions", () => {
    it("non tocca chi è ancora nel periodo di tolleranza né chi è attivo", async () => {
      await run("ios", iosPurchase());
      clock = NOW + 30 * DAY + 3600000; // scaduto da un'ora (< 24 ore di tolleranza)
      assert.equal(await svc.expireSubscriptions(), 0);
      assert.equal(db.tree.users.u1.subData.status, "active");
    });

    it("dopo la tolleranza segna scaduto, azzera il ruolo e toglie l'indice", async () => {
      await run("ios", iosPurchase());
      clock = NOW + 32 * DAY;
      assert.equal(await svc.expireSubscriptions(), 1);
      assert.equal(db.tree.users.u1.subData.status, "expired");
      assert.equal(db.tree.users.u1.subData.role, "free");
      assert.equal(db.tree.users.u1.sub, undefined);
      assert.equal(db.tree.activeSubscriptions, undefined);
    });

    it("se nel frattempo è arrivato un rinnovo non lo scade", async () => {
      await run("ios", iosPurchase());
      apple.notification = {notificationType: "DID_RENEW", data: {signedTransactionInfo: "S", environment: "Production"}};
      apple.tx = {...apple.tx, expiresDate: NOW + 90 * DAY};
      await svc.handleAppleNotification("p");
      clock = NOW + 32 * DAY;
      assert.equal(await svc.expireSubscriptions(), 0);
      assert.equal(db.tree.users.u1.subData.status, "active");
    });
  });
});
