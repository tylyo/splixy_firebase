"use strict";
const admin = require("firebase-admin");
const adminDB = admin.database();

/**
 * Invia la notifica push di modifica del gruppo ai dispositivi degli utenti indicati.
 * I token FCM sono in /fcmTokens/{uid}/tkn.
 * @param {Array} to uid dei destinatari
 * @param {string} lang lingua (non ancora usata)
 * @param {object} event evento: gnm (nome gruppo), tnm (nome transazione), gid, tid
 */
async function sendNotification(to = [], lang = "en", event) {
  console.log(to, lang, event);
  if (to.length == 0 || event === undefined || event == null) return;
  const promises = to.map(function(uid) {
    return adminDB.ref("fcmTokens").child(uid).child("tkn").once("value", (snap) => {
      return snap.val();
    });
  });

  const payload = {
    "notification": {
      "title": "Splixy - Modifica al gruppo " + event["gnm"],
      "body": "Sono state apportate modifiche alla transazione " + event["tnm"],
    },
    "data": {
      "gid": event["gid"],
      "tid": event["tid"],
    },
  };

  Promise.all(promises).then((results) => {
    results.forEach(
        (snap, idx) => {
          if (snap.val() == null) {
            return;
          }
          const token = snap.val();
          console.log("messaging: sending", idx, "for", event["gnm"]);
          admin.messaging().sendToDevice(token, payload)
              .then((response) => {
                console.log("messaging sent:", response.successCount, response.failureCount);
                if (response.failureCount == 0) {
                  return;
                }
                response.results.forEach((resp) => {
                  if (!resp.success) {
                    console.log("messaging Error", resp.error);
                  }
                });
              }).catch((error) => {
                console.log("Error sending message:", error);
              });
        },
    );
  });
}

module.exports = {sendNotification};
