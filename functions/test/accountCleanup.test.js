"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {planWalletExit} = require("../accountCleanup");

const wallet = (extra = {}) => Object.assign({
  acl: {c: {me: true}, r: {me: true}, w: {me: true}},
  creator: {me: "Me"},
  quotas: {m1: {name: "Me", user: "me"}, m2: {name: "Giulia"}},
}, extra);

describe("planWalletExit", () => {
  it("elimina il wallet con transazioni e log se l'utente è l'unico con accesso", () => {
    const plan = planWalletExit("w1", wallet(), "me");
    assert.equal(plan.action, "delete");
    assert.deepEqual(plan.updates, {"wallets/w1": null, "transactions/w1": null, "logEvents/w1": null});
    assert.equal(plan.newCreator, null);
  });

  it("gli utenti già usciti (acl false) non contano come altri utenti", () => {
    const w = wallet({acl: {c: {me: true}, r: {me: true, gone: false}, w: {me: true, gone: false}}});
    assert.equal(planWalletExit("w1", w, "me").action, "delete");
  });

  it("lascia il wallet agli altri, scollega il partecipante senza eliminarlo e passa il ruolo di creatore", () => {
    const w = wallet({acl: {c: {me: true}, r: {me: true, bob: true, ann: true}, w: {me: true, ann: true}}});
    const plan = planWalletExit("w1", w, "me");
    assert.equal(plan.action, "leave");
    assert.equal(plan.newCreator, "ann"); // chi può scrivere ha la precedenza
    assert.deepEqual(plan.updates, {
      "wallets/w1/acl/c/me": null, "wallets/w1/acl/r/me": null, "wallets/w1/acl/w/me": null,
      "wallets/w1/quotas/m1/user": null,
      "wallets/w1/acl/c/ann": true, "wallets/w1/acl/r/ann": true, "wallets/w1/acl/w/ann": true,
    });
    assert.ok(!Object.keys(plan.updates).includes("wallets/w1/quotas/m1"), "il partecipante non va eliminato");
  });

  it("se c'è un altro creatore non promuove nessuno ma aggiorna il riferimento creator", () => {
    const w = wallet({acl: {c: {me: true, bob: true}, r: {me: true, bob: true}, w: {me: true, bob: true}}});
    const plan = planWalletExit("w1", w, "me");
    assert.equal(plan.action, "leave");
    assert.equal(plan.newCreator, "bob");
    assert.equal(plan.updates["wallets/w1/acl/c/bob"], undefined);
  });

  it("un semplice partecipante esce senza toccare il creatore", () => {
    const w = wallet({
      acl: {c: {boss: true}, r: {boss: true, me: true}, w: {boss: true, me: true}},
      creator: {boss: "Boss"},
    });
    const plan = planWalletExit("w1", w, "me");
    assert.equal(plan.action, "leave");
    assert.equal(plan.newCreator, null);
    assert.deepEqual(Object.keys(plan.updates).sort(), [
      "wallets/w1/acl/c/me", "wallets/w1/acl/r/me", "wallets/w1/acl/w/me", "wallets/w1/quotas/m1/user",
    ]);
  });
});
