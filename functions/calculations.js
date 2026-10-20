"use strict";
/**
 * Calcolo delle quote dei partecipanti a partire dalle transazioni.
 * Solo logica pura: nessun accesso al database (vedi walletQuotas.js per la scrittura).
 */
const {round3Dec} = require("./commons");
const {WalletMember} = require("./models");

/**
 * Effetto di una transazione sui partecipanti.
 * - item: chi ha pagato aumenta "p", ogni debitore aumenta "s" (parti * quota)
 * - move: il debitore aumenta "m", il creditore lo diminuisce
 * @param {TrxObj} currTrx transazione
 * @return {{walletUPD: object, quota: number}} variazioni per membro e quota ricalcolata (0 se invariata)
 */
function calculate(currTrx) {
  const trxId = currTrx.uid;
  const trxType = currTrx.t;
  const credKey = currTrx.cred;

  const paid = round3Dec(currTrx.a * currTrx.qt);
  let parts = 100;
  if (currTrx.q.t == "parts") {
    parts = 0;
    for (const key in currTrx.debs) {
      parts += currTrx.debs[key];
    }
  }

  if (currTrx.qt > 1) console.info(trxId, "QUANTITY CHECK", currTrx.qt);

  const updatesMember = {};
  let quotaCheck = 0.0;
  // per i "move" resta undefined: il chiamante scrive la quota ricalcolata solo se > 0
  let quotaAmount;
  if (trxType == "item") {
    updatesMember[credKey] = new WalletMember(credKey, paid, 0, 0, 1);
    quotaAmount = round3Dec(paid / parts);

    if (quotaAmount !== round3Dec(currTrx.q.a)) {
      console.warn(trxId, "QUOTA DIVERSA QUELLA REGISTRATA", quotaAmount, currTrx.q.a, currTrx.qt + "*" + paid + "*" + parts);
    }
    for (const key in currTrx.debs) {
      const part = currTrx.debs[[key]];
      const debt = round3Dec(part * quotaAmount);
      quotaCheck += debt;
      let result = new WalletMember(key, 0, debt, 0, 1);
      if (Object.prototype.hasOwnProperty.call(updatesMember, key)) {
        result = new WalletMember(key, paid, debt, 0, 1);
      }
      updatesMember[key] = result;
    }
    const delta = round3Dec(paid) - round3Dec(quotaCheck);
    if (Math.abs(delta) > 0.01) console.error(trxId, "PAID != quote sum", paid, quotaCheck, delta);
  } else {
    let idx = 0;
    for (const key in currTrx.debs) {
      idx += 1;
      updatesMember[key] = new WalletMember(key, 0, 0, paid, 1);
    }
    if (idx > 1) console.error(trxId, "MOVE - more debs", paid);
    updatesMember[credKey] = new WalletMember(credKey, 0, 0, -paid, 1);
  }

  const checkM = new WalletMember("checkM", 0, 0, 0, 1);
  for (const k in updatesMember) {
    checkM.add(updatesMember[k]);
  }
  if (checkM.q > 0) console.log("CHECKM", trxId, checkM.toMap());

  return {
    "walletUPD": updatesMember,
    "quota": (quotaAmount !== round3Dec(currTrx.q.a)) ? quotaAmount : 0,
  };
}

/**
 * Aggiunge ai debitori della nuova versione quelli rimossi (e azzera i valori), così
 * i membri non più presenti vengono comunque considerati nell'aggiornamento.
 * Muta e ritorna nextDebitors.
 * @param {object} currDebitors debitori prima della modifica
 * @param {object} nextDebitors debitori dopo la modifica
 * @return {object} nextDebitors
 */
function trxDebsRemove(currDebitors, nextDebitors) {
  const oldKeys = Object.keys(currDebitors);
  const updKeys = Object.keys(nextDebitors);

  console.log("trxDebsRemove", JSON.stringify(oldKeys), JSON.stringify(updKeys));
  const filteredKeys = oldKeys.filter((x) => !updKeys.includes(x));
  if (filteredKeys.length > 0) {
    for (const ko in oldKeys) {
      if (Object.prototype.hasOwnProperty.call(oldKeys, ko)) {
        console.log(oldKeys[ko], "-> 0");
        nextDebitors[oldKeys[ko]] = 0.0;
      }
    }
  }
  console.log("updDebitors:" + JSON.stringify(nextDebitors));

  return nextDebitors;
}

/**
 * Differenza fra due versioni della stessa transazione, per membro.
 * @param {string} walletId id del wallet (solo per i log)
 * @param {TrxObj} currTrx versione precedente
 * @param {TrxObj} nextTrx versione nuova
 * @return {object} membro -> WalletMember con le variazioni da applicare
 */
function trxUpdateToWallet(walletId, currTrx, nextTrx) {
  console.group("trxUpdateToWallet");
  const currCalc = calculate(currTrx).walletUPD;
  const nextCalc = calculate(nextTrx).walletUPD;
  console.debug("trxUpdateToWallet START calc curr", currCalc);
  console.debug("trxUpdateToWallet START calc next", nextCalc);

  const currDebitors = currTrx.debs;
  let nextDebitors = nextTrx.debs;
  nextDebitors = trxDebsRemove(currDebitors, nextDebitors);
  const updatesMember = {};
  for (const key in nextDebitors) {
    if (currCalc[key] === undefined) {
      currCalc[key] = new WalletMember(0, 0, 0, 0, 0);
    }
    if (nextCalc[key] === undefined) {
      nextCalc[key] = new WalletMember(0, 0, 0, 0, 0);
    }
    const currS = Object.prototype.hasOwnProperty.call(currCalc[key], "s") ? currCalc[key].s : 0;

    const paid = nextCalc[key].p - currCalc[key].p;
    const debt = nextCalc[key].s - currS;
    const move = nextCalc[key].m - currCalc[key].m;
    const trxC = nextCalc[key].trxc - currCalc[key].trxc;
    updatesMember[key] = new WalletMember(key, paid, debt, move, trxC);
  }
  console.debug({updatesMember});
  console.groupEnd();
  return updatesMember;
}

module.exports = {calculate, trxDebsRemove, trxUpdateToWallet};
