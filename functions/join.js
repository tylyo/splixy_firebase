"use strict";
/**
 * Partecipazione ai wallet: richiesta di accesso, link di condivisione, ingresso e uscita di un utente.
 */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const adminDB = admin.database();
const {
  COLLECTION_JOINREQUEST,
  COLLECTION_USERS,
  COLLECTION_WALLETS,
  FLD_MEMBERS,
  PATH_SEPARATOR,
  getMapVal,
} = require("./commons");

// TODO: da rimuovere (flusso sostituito dal link di condivisione)
exports.askToJoinWallet = functions.database.ref("/users/{uid}/wallets/{walletId}/requests/")
    .onWrite(async (change, context) => {
      if (!change.before.exists()) {
        const walletId = context.params.walletId;
        const userRef = change.before.ref.parent.parent;
        const name = (await userRef.child("displayName").once("value")).exportVal();
        const avatar = (await userRef.child("info/av").once("value")).exportVal();

        const userInfo = (await userRef.child("info").once("value")).exportVal();
        console.log("userinfo:" + JSON.stringify(userInfo));
        userInfo["name"] = name;
        userInfo["av"] = avatar;
        console.log("parent:" + JSON.stringify(userInfo));
        const uid = context.auth.uid;
        adminDB.ref(COLLECTION_WALLETS).child(walletId).child("requests").child(uid).set(userInfo);
      }
      if (!change.after.exists()) {
        console.log("askToJoinWallet Deleted node: " + change.before.key);
      } else if (change.before.exists()) {
        console.log("askToJoinWallet Updated node: " + change.after.key);
      } else {
        console.log("askToJoinWallet boh: ");
      }
      return change.after.ref;
    });

/**
 * Condivisione wallet, passo 2: l'utente apre il link (/users/{uid}/joinreq/{sl}); si cerca il wallet
 * con quel link e si concede all'utente la lettura (acl/r). Da quel momento può vedere il wallet e
 * scegliere con quale partecipante unirsi.
 */
exports.usersSavewalletshareLink = functions.database.ref("/users/{uid}/" + COLLECTION_JOINREQUEST + "/{sl}")
    .onWrite(async (snap, context) => {
      const sharedLinkID = context.params.sl;
      const uid = context.params.uid;
      console.log("usersSavewalletshareLink -- start --");
      console.log("request: ", uid, sharedLinkID);
      await adminDB.ref(COLLECTION_WALLETS).orderByChild("sl").equalTo(sharedLinkID).limitToFirst(1).get()
          .then(async (snap) => {
            const wallets = snap.val();

            if (wallets === undefined || wallets === null) {
              return snap.ref;
            }
            const walletId = Object.keys(wallets)[0];
            const updates = {};
            console.log("request: ", uid, sharedLinkID);

            updates[COLLECTION_WALLETS + PATH_SEPARATOR + walletId + "/acl/r/" + uid] = true;

            const walletJoinReqPath = [COLLECTION_USERS, uid, COLLECTION_JOINREQUEST, sharedLinkID, "id"].join(PATH_SEPARATOR);
            updates[walletJoinReqPath] = walletId;
            console.log("updates: " + JSON.stringify(updates));
            await adminDB.ref().update(updates);

            return snap.ref;
          });
      return snap.ref;
    });

exports.userJoinedWallet = functions.database.ref("/wallets/{walletId}/acl/r/{uid}")
    .onWrite(async (change, context) => {
      const nextVal = change.after.val();
      const authId = context.params.uid;
      const walletId = context.params.walletId;
      const params = {
        "nextVal": nextVal, "authId": authId, "walletId": walletId,
      };
      console.log("updates: " + JSON.stringify(params));

      if (nextVal !== undefined && nextVal === true) {
        adminDB.ref(COLLECTION_JOINREQUEST).child(authId).child(walletId).remove();
        return change;
      }
    });

/**
 * Copia nome, avatar e colore dell'utente nel membro del wallet con cui si è unito.
 * @param {DataSnapshot} snap profilo dell'utente (/users/{uid})
 * @param {string} walletId id del wallet
 * @param {string} memberId id del membro scelto
 */
function joinWalletUpdateWithMember(snap, walletId, memberId) {
  const userData = snap.val();
  console.log("check:userData " + JSON.stringify(userData));
  const updates = {
    "name": getMapVal(userData, "displayName", "UserName"),
    "a": getMapVal(userData, "a", "010203040506"),
    "c": getMapVal(userData, "c", "FF342134"),
    "user": snap.key,
  };
  console.log("check: updates" + JSON.stringify(updates));

  adminDB.ref(COLLECTION_WALLETS).child(walletId).child("quotas").child(memberId).update(updates);
}

/**
 * Ingresso/uscita di un utente da un wallet (/users/{uid}/g/{walletId}):
 * - valore presente: l'utente si unisce al membro "mid"
 * - valore rimosso: revoca lettura/scrittura e scollega l'utente dal membro
 */
exports.usersGroupUpdate = functions.database.ref("/users/{uid}/g/{walletId}")
    .onWrite(async (change, context) => {
      // le scritture admin (es. eliminazione account, vedi accountDeletion.js) non sono ingressi/uscite dell'utente
      if (context.authType === "ADMIN") return null;
      const walletId = context.params.walletId;
      const authId = context.auth.uid;
      const memberValues = change.after.val();

      if (memberValues == null || memberValues === undefined) { // LEAVE
        const data = change.before.val();
        const mid = data["mid"];

        const updates = {};
        updates["acl/r/" + authId] = false;
        updates["acl/w/" + authId] = false;
        updates[FLD_MEMBERS + PATH_SEPARATOR + mid + PATH_SEPARATOR + authId] = null;
        console.log(JSON.stringify(updates));
        const ref = adminDB.ref(COLLECTION_WALLETS).child(walletId);
        console.log(JSON.stringify(ref));
        ref.update(updates);
      } else { // JOIN
        const memberId = memberValues["mid"];
        adminDB.ref(COLLECTION_USERS).child(authId).once("value", (snap) => joinWalletUpdateWithMember(snap, walletId, memberId));
      }

      return change.after.ref;
    });
