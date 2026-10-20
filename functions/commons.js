"use strict";

exports.PATH_SEPARATOR = "/";

exports.COLLECTION_JOINREQUEST = "joinreq";
exports.COLLECTION_USERS = "users";
exports.COLLECTION_WALLETS = "wallets";
exports.COLLECTION_TRANSACTIONS = "transactions";

// chiavi dei nodi RTDB (abbreviate: vedi i @JsonKey dei model Dart)
exports.FLD_MEMBERS = "quotas";

/**
 * Tempo corrente in secondi.
 * @return {number} secondi da epoch
 */
exports.currentTM = function currentTM() {
  return Math.floor(Date.now() / 1000);
};

/**
 * Intero casuale in [0, max).
 * @param {number} max estremo escluso
 * @return {number} intero casuale
 */
exports.getRandomInt = function getRandomInt(max) {
  return Math.floor(Math.random() * max);
};

/**
 * Arrotonda a 5 decimali (precisione usata dai calcoli delle quote).
 * @param {number} num valore da arrotondare
 * @return {number} valore arrotondato
 */
exports.round3Dec = function round3Dec(num) {
  return (Math.round((num) * 100000) / 100000);
};

/**
 * Legge una chiave da una mappa restituendo un default se manca o è nulla.
 * @param {object} map mappa (può essere null/undefined)
 * @param {string} key chiave
 * @param {*} def valore di default
 * @return {*} il valore o il default
 */
exports.getMapVal = function getMapVal(map, key, def) {
  if (map === null || map === undefined ||
    !Object.prototype.hasOwnProperty.call(map, key) ||
    map[key] === null || map[key] === undefined) {
    return def;
  }
  return map[key];
};
