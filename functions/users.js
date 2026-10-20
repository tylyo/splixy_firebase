"use strict";
const functions = require("firebase-functions/v1");

/**
 * Ad ogni login (scrittura di /users/{userId}/lastLogin) copia nel profilo lo stato di verifica email.
 */
exports.updateAuthUser = functions.database.ref("/users/{userId}/lastLogin").onWrite((change, context) => {
  const u_id = context.auth?.uid;
  const email_verified = context.auth?.token.email_verified;
  const provider = context.auth?.token.firebase.sign_in_provider;

  if (provider !== undefined || provider == "password") {
    functions.logger.info({
      "uid": u_id,
      "ev:": email_verified,
      "ref": JSON.stringify(change.after.parent),
    });

    change.after.ref.parent.child("ev").set(email_verified);
  }

  return change.after;
});
