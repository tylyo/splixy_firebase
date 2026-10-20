"use strict";
/**
 * Logica pura per togliere un utente da un wallet durante l'eliminazione dell'account.
 * Nessun accesso al database: vedi accountDeletion.js. Non viene ri-esportata da index.js.
 */
const {COLLECTION_TRANSACTIONS, COLLECTION_WALLETS} = require("./commons");

const COLLECTION_LOG_EVENTS = "logEvents";

/**
 * Chiavi con valore true di una mappa acl (un valore false indica un utente già uscito).
 * @param {object} map mappa uid -> boolean
 * @param {string} exclude uid da escludere
 * @return {string[]} uid attivi
 */
function activeKeys(map, exclude) {
  return Object.keys(map || {}).filter((k) => map[k] === true && k !== exclude);
}

/**
 * Calcola gli aggiornamenti RTDB (percorsi dalla radice) per togliere un utente da un wallet.
 * - nessun altro utente con accesso: il wallet viene eliminato con transazioni e log;
 * - altrimenti il wallet resta agli altri: l'utente esce dall'acl, il suo partecipante resta
 *   (stesso nome, nessun collegamento all'account) per non alterare i saldi, e se era l'unico
 *   creatore il ruolo passa al primo altro utente (preferendo chi può scrivere).
 * Il partecipante (quotas/{id}) non viene mai eliminato: farlo attiverebbe memberRemove, che lo
 * toglie dalle transazioni e ricalcola i saldi degli altri.
 * @param {string} walletId id del wallet
 * @param {object} wallet valore RTDB del wallet
 * @param {string} uid utente da togliere
 * @return {{action: string, updates: object, newCreator: (string|null)}} newCreator è l'uid che deve
 *   diventare il riferimento "creator" del wallet (null se non cambia)
 */
function planWalletExit(walletId, wallet, uid) {
  const base = `${COLLECTION_WALLETS}/${walletId}`;
  const acl = (wallet && wallet.acl) || {};
  const creators = activeKeys(acl.c, uid);
  const writers = activeKeys(acl.w, uid);
  const readers = activeKeys(acl.r, uid);
  const others = [...new Set([...creators, ...writers, ...readers])];

  if (others.length === 0) {
    return {
      action: "delete",
      updates: {
        [base]: null,
        [`${COLLECTION_TRANSACTIONS}/${walletId}`]: null,
        [`${COLLECTION_LOG_EVENTS}/${walletId}`]: null,
      },
      newCreator: null,
    };
  }

  const updates = {};
  for (const role of ["c", "r", "w"]) {
    updates[`${base}/acl/${role}/${uid}`] = null;
  }

  const quotas = wallet.quotas || {};
  for (const memberId of Object.keys(quotas)) {
    if (quotas[memberId] && quotas[memberId].user === uid) {
      updates[`${base}/quotas/${memberId}/user`] = null;
    }
  }

  let newCreator = null;
  if (acl.c && acl.c[uid] === true && creators.length === 0) {
    newCreator = writers[0] || readers[0];
    for (const role of ["c", "r", "w"]) {
      updates[`${base}/acl/${role}/${newCreator}`] = true;
    }
  } else if (wallet.creator && Object.prototype.hasOwnProperty.call(wallet.creator, uid)) {
    newCreator = creators[0] || writers[0] || readers[0];
  }

  return {action: "leave", updates, newCreator};
}

module.exports = {planWalletExit, activeKeys};
