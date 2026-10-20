"use strict";

/**
 * Calcolo delle quote (calculations.js): solo logica pura, nessun accesso a Firebase.
 * Convenzione: p = pagato, s = speso, m = movimentato, q = p - s + m, trxc = numero transazioni.
 */

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {calculate, trxDebsRemove, trxUpdateToWallet} = require("../calculations");
const {trxFromSnap} = require("../models");
const {getMapVal, round3Dec} = require("../commons");

const item = (over = {}) => trxFromSnap({
  name: "cena", t: "item", cred: "a", a: 90, qt: 1,
  debs: {a: 1, b: 1, c: 1}, q: {t: "parts", a: 30}, ...over,
}, "t1");

const move = (over = {}) => trxFromSnap({
  name: "saldo", t: "move", cred: "a", a: 50, qt: 1,
  debs: {b: 1}, q: {t: "parts", a: 1}, ...over,
}, "t2");

const pick = (m) => ({p: m.p, s: m.s, m: m.m, q: m.q, trxc: m.trxc});

describe("calculate - spesa (item)", () => {
  it("divide in parti uguali: chi paga anticipa, tutti spendono la propria quota", () => {
    const upd = calculate(item()).walletUPD;

    assert.deepEqual(pick(upd.a), {p: 90, s: 30, m: 0, q: 60, trxc: 1});
    assert.deepEqual(pick(upd.b), {p: 0, s: 30, m: 0, q: -30, trxc: 1});
    assert.deepEqual(pick(upd.c), {p: 0, s: 30, m: 0, q: -30, trxc: 1});
  });

  it("rispetta le parti diverse per partecipante", () => {
    const upd = calculate(item({debs: {a: 1, b: 2}, q: {t: "parts", a: 30}})).walletUPD;

    assert.equal(upd.a.s, 30);
    assert.equal(upd.b.s, 60);
    assert.equal(upd.a.q + upd.b.q, 0, "la somma delle quote è sempre zero");
  });

  it("moltiplica l'importo per la quantità", () => {
    const upd = calculate(item({a: 10, qt: 3, debs: {a: 1, b: 1}, q: {t: "parts", a: 15}})).walletUPD;

    assert.equal(upd.a.p, 30);
    assert.equal(upd.b.s, 15);
  });

  it("ritorna la quota ricalcolata solo se diversa da quella registrata", () => {
    assert.equal(calculate(item()).quota, 0);
    assert.equal(calculate(item({q: {t: "parts", a: 99}})).quota, 30);
  });

  it("chi paga può non essere fra i debitori", () => {
    const upd = calculate(item({cred: "z", debs: {a: 1, b: 1}, q: {t: "parts", a: 45}})).walletUPD;

    assert.deepEqual(pick(upd.z), {p: 90, s: 0, m: 0, q: 90, trxc: 1});
  });
});

describe("calculate - movimento (move)", () => {
  it("il debitore aumenta il movimentato, il creditore lo diminuisce", () => {
    const upd = calculate(move()).walletUPD;

    assert.deepEqual(pick(upd.b), {p: 0, s: 0, m: 50, q: 50, trxc: 1});
    assert.deepEqual(pick(upd.a), {p: 0, s: 0, m: -50, q: -50, trxc: 1});
  });

  it("non ricalcola la quota base", () => {
    assert.ok(!(calculate(move()).quota > 0));
  });

  it("con più debitori non va in errore (segnala soltanto)", () => {
    assert.doesNotThrow(() => calculate(move({debs: {b: 1, c: 1}})));
  });
});

describe("trxUpdateToWallet - differenza fra due versioni", () => {
  it("modifica dell'importo: ripartisce la differenza", () => {
    const upd = trxUpdateToWallet("w", item(), item({a: 120, q: {t: "parts", a: 40}}));

    assert.deepEqual(pick(upd.a), {p: 30, s: 10, m: 0, q: 20, trxc: 0});
    assert.deepEqual(pick(upd.b), {p: 0, s: 10, m: 0, q: -10, trxc: 0});
    assert.deepEqual(pick(upd.c), {p: 0, s: 10, m: 0, q: -10, trxc: 0});
  });

  it("partecipante rimosso: gli viene tolta la sua quota e la transazione", () => {
    const upd = trxUpdateToWallet("w", item(), item({debs: {a: 1, b: 1}, q: {t: "parts", a: 45}}));

    assert.deepEqual(pick(upd.c), {p: 0, s: -30, m: 0, q: 30, trxc: -1});
    assert.equal(upd.a.s, 15);
    assert.equal(upd.b.s, 15);
  });

  it("nessuna modifica: variazioni nulle", () => {
    const upd = trxUpdateToWallet("w", item(), item());

    for (const k of ["a", "b", "c"]) {
      assert.deepEqual(pick(upd[k]), {p: 0, s: 0, m: 0, q: 0, trxc: 0});
    }
  });
});

describe("trxDebsRemove", () => {
  it("senza rimozioni lascia i debitori invariati", () => {
    assert.deepEqual(trxDebsRemove({a: 1, b: 1}, {a: 1, b: 2}), {a: 1, b: 2});
  });

  it("con una rimozione include anche i vecchi debitori nell'aggiornamento", () => {
    assert.deepEqual(Object.keys(trxDebsRemove({a: 1, b: 1, c: 1}, {a: 1, b: 1})).sort(), ["a", "b", "c"]);
  });
});

describe("helper", () => {
  it("round3Dec arrotonda a 5 decimali", () => {
    assert.equal(round3Dec(1 / 3), 0.33333);
  });

  it("getMapVal restituisce il default per mappe assenti, chiavi mancanti o nulle", () => {
    assert.equal(getMapVal(null, "x", 7), 7);
    assert.equal(getMapVal(undefined, "x", 7), 7);
    assert.equal(getMapVal({}, "x", 7), 7);
    assert.equal(getMapVal({x: null}, "x", 7), 7);
    assert.equal(getMapVal({x: 0}, "x", 7), 0);
  });
});
