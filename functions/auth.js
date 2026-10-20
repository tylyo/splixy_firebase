"use strict";
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const adminDB = admin.database();
const {COLLECTION_USERS, PATH_SEPARATOR, getRandomInt} = require("./commons");

/**
 * Avatar casuale: 6 coppie di cifre (0-46), come si aspetta MyMultiAvatar nell'app.
 * @return {string} stringa di 12 caratteri
 */
function createAvatar() {
  const ret = ["00", "00", "00", "00", "00", "00"];
  for (let idx = 0; idx < 6; idx++) {
    const num = getRandomInt(47);
    let str = num.toString();
    if (num < 10) {
      str = "0" + num.toString();
    }
    ret[idx] = str;
  }
  console.log(ret);
  return ret.join("");
}

/**
 * Alla creazione di un utente Firebase Auth inizializza il suo profilo in /users/{uid}.
 */
exports.authUser = functions.auth.user().onCreate((userRecord, context) => {
  console.log("authUser -- start --", JSON.stringify(context));

  const uid = userRecord.uid;
  const email = userRecord.email;
  let _displayName = userRecord.displayName;
  if (_displayName === undefined || userRecord.displayName === null) {
    _displayName = "Member";
  }
  const providerId = userRecord.providerData[0].providerId;
  console.log("authUser uid:%s email:%s", uid, email);
  if (email !== undefined) {
    console.log(_displayName);
    _displayName = email.split("@")[0].replace(".", " ");
    while (_displayName.length < 8) {
      _displayName = _displayName + getRandomInt(9);
    }
    userRecord.displayName = _displayName;
  }
  console.log("providerId %s, email:%s, user %s,displayName:%s",
      providerId, email, uid, _displayName);

  adminDB.ref(COLLECTION_USERS + PATH_SEPARATOR + uid + PATH_SEPARATOR).update({
    "displayName": _displayName,
    "a": createAvatar(),
    "ev": userRecord.emailVerified,
  });

  return userRecord;
});
