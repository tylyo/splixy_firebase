"use strict";
const {currentTM, round3Dec} = require("./commons");

/** Evento "ultima modifica" inviato nelle notifiche. */
class LastEvent {
  event;
  tid;
  tnm;
  u;
  ts = currentTM();
  extra = null;

  /**
   * @param {string} event tipo di evento (trxAdd, trxUpd, trxDel)
   * @param {string} trxId id della transazione
   * @param {string} trx nome della transazione
   * @param {string} user uid di chi ha fatto la modifica
   */
  constructor(event, trxId, trx, user) {
    this.event = event;
    this.tid = trxId;
    this.tnm = trx;
    this.u = user;
    this.ts = currentTM();
  }

  /** @return {Map} l'evento come Map */
  toMap() {
    return new Map(Object.entries(this));
  }
}

/** Transazione normalizzata per i calcoli delle quote. */
class TrxObj {
  uid = "";
  n = "";
  debs = {};
  q = {
    t: "parts",
    a: 0.0,
  };
  qt = 1.0;
  a = 0.0;
  cred = "";
  t = "item";

  /**
   * @param {string} uid id della transazione
   * @param {string} name nome
   * @param {string} type item | move
   * @param {object} debs partecipanti -> parti
   * @param {object} quota {t, a}
   * @param {number} quantity quantità
   * @param {number} amount importo
   * @param {string} creditor id del membro che ha pagato
   */
  constructor(uid, name, type, debs, quota, quantity, amount, creditor) {
    this.uid = uid;
    this.nm = name;
    this.t = type;
    this.debs = debs;
    this.a = round3Dec(amount);
    this.cred = creditor;
    this.q = quota;
    this.q.a = round3Dec(quota["a"]);
    this.qt = quantity;
  }

  /** @return {number} importo per quantità */
  getAmountQT() {
    return round3Dec(this.qt * this.q.a);
  }
}

/**
 * Costruisce una TrxObj dallo snapshot RTDB; in caso di dati malformati logga e ritorna undefined.
 * @param {object} map valore della transazione
 * @param {string} key id della transazione
 * @return {TrxObj|undefined} la transazione
 */
function trxFromSnap(map, key) {
  try {
    return new TrxObj(key,
        map.name,
        map.t,
        map.debs,
        {"a": map.q["a"], "t": map.q["t"]},
        map.qt,
        map.a,
        map.cred,
    );
  } catch (err) {
    console.error(key, err);
  }
}

/** Quota di un partecipante in un wallet. */
class WalletMember {
  uid = "";
  p = 0.0;
  s = 0.0;
  q = 0.0;
  m = 0.0;
  trxc = 0;

  /**
   * @param {string} uid id del membro
   * @param {number} p pagato
   * @param {number} s speso
   * @param {number} m movimentato
   * @param {number} trxc numero di transazioni
   */
  constructor(uid, p, s, m, trxc = 0) {
    this.uid = uid;
    this.p = round3Dec(p);
    this.s = round3Dec(s);
    this.m = round3Dec(m);
    this.q = round3Dec(p - s + m);
    this.trxc = trxc;
  }

  /** @return {WalletMember} se stesso con i segni invertiti */
  subtract() {
    this.p *= -1;
    this.s *= -1;
    this.m *= -1;
    this.q *= -1;
    return this;
  }

  /**
   * Somma i valori di un altro membro.
   * @param {WalletMember} member valori da sommare
   */
  add(member) {
    this.p += round3Dec(member.p);
    this.s += round3Dec(member.s);
    this.m += round3Dec(member.m);
    this.q = round3Dec(this.p - this.s + this.m);
    this.trxc += 1;
  }

  /** @return {object} i valori nel formato RTDB */
  toMap() {
    return {
      "p": this.p,
      "s": this.s,
      "m": this.m,
      "q": this.q,
      "trxc": this.trxc,
    };
  }

  /** @return {Array} i valori come array */
  toStr() {
    return [this.uid, this.p, this.s, this.m, this.q];
  }
}

module.exports = {LastEvent, TrxObj, WalletMember, trxFromSnap};
