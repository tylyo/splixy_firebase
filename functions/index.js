/* eslint-disable arrow-body-style */
/* eslint-disable max-len */
'use strict';
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  credential,
  database
} = require("firebase-admin");
// const {DataSnapshot} = require("firebase-functions/v1/database");
// const {instance, DataSnapshot} = require("firebase-functions/v1/database");
admin.initializeApp(functions.config().firebase);
const adminDB = admin.database();
const PATH_SEPARATOR = "/";
const COLLECTION_JOINREQUEST = "joinreq";
const COLLECTION_USERS = "users";
const COLLECTION_WALLETS = "wallets";
const COLLECTION_TRANSACTIONS = "transactions";
const COLLECTION_PURCHASES = "puchases";
const COLLECTION_USERSTATS = "userStats";

// const adminFire = admin.firestore();

// const names = [];
exports.authUser = functions.auth.user().onCreate((userRecord, context) => {
  // console.log("authUser - userRecord:" + userRecord.toJSON());
  // })
  // exports.updateUserBounds = functions.https.onCall((data, context) => {
  console.log("authUser -- start --");

  const uid = userRecord.uid;
  const email = userRecord.email;
  let _displayName = userRecord.displayName;
  if (_displayName === undefined || userRecord.displayName === null) {
    _displayName = "Player";
  }
  const providerId = userRecord.providerData[0].providerId;
  console.log("uid:%s email:%s", uid, email);
  if (email !== undefined) {
    console.log(_displayName);
    _displayName = email.split("@")[0].replace(".", " ");
    userRecord.displayName = _displayName;
  }
  console.log("providerId %s, email:%s, user %s,displayName:%s",
    providerId, email, uid, _displayName);

  adminDB.ref(COLLECTION_USERS + PATH_SEPARATOR + uid + PATH_SEPARATOR).update({
    "displayName": _displayName,
    "a": "323023232323",

  });

  return userRecord;
});
/**
 * get current time in ms
 * @return {number}  The sum of the two numbers.
 */
function currentTM() {
  return Math.floor(Date.now() / 1000);
}
/**
 * asdasd
 * @param {object}context asdasd
 * @return {number}  The sum of the two numbers.
 */
function buildCreationParams(context) {
  const uid = context.auth.uid;
  // console.log(JSON.stringify(context))
  const creator = {};
  creator[uid] = "User";
  const contextName = context.auth.token.name;
  if (contextName !== undefined && contextName !== null) {
    creator[uid] = contextName;
  }
  const updates = {};
  const uidACL = {};
  uidACL[uid] = true;
  // const creationACL = {
  //     "r": uidACL,
  //     "w": uidACL,
  //     "c": uidACL,
  // };
  updates["acl/r/" + uid + PATH_SEPARATOR] = true;
  updates["acl/w/" + uid + PATH_SEPARATOR] = true;
  updates["acl/c/"] = uidACL;
  updates["creator"] = creator;
  updates["created"] = currentTM();
  updates["updated"] = currentTM();
  // updates["sl"] = randomString(8) + uid.substring(0,4) + randomString(4);

  return updates;
}

/**
 * updates
 * @param {object}context asdasd
 * @return {map} updates to be done on the entity
 */
function buildwalletOnCreate(context) {
  const uid = context.auth.uid;
  const updates = {};

  const firstplayer = "teams/t1/players/t1_p1";
  // updates[firstplayer + "/uid"] = uid;
  updates[firstplayer + "/u"] = uid;

  if (context.auth.token.email !== undefined) {
    let nick = context.auth.token.email.split("@", 1)[0];
    nick = nick.replace(/\./, " ");
    if (nick.length > 15) {
      nick = nick.substring(0, 15);
    }
    updates[firstplayer + "/name"] = nick;
  }
  console.log("creation updates:" + JSON.stringify(updates));
  return updates;
}
exports.walletCreate = functions.database.ref("/" + COLLECTION_WALLETS + "/{walletId}").onCreate((snap, context) => {
  // // var walletId = context.params.walletId
  // // const log = new LogEvent(context, "wallet", walletId)
  const creationUpdates = buildCreationParams(context);
  console.log("creationUpdates: " + JSON.stringify(creationUpdates));
  const walletUpdates = buildwalletOnCreate(context);
  console.log("walletUpdates: " + JSON.stringify(walletUpdates));
  if (!snap.hasChild("playerId")) {
    // eslint-disable-next-line guard-for-in
    for (const x in walletUpdates) {
      creationUpdates[x] = walletUpdates[x];
    }
  }

  console.log("val: " + JSON.stringify(snap.val()));

  // return await snap.ref.update(creationUpdates);
  return snap;
});


exports.walletNameUpdate = functions.database.ref("/wallets/{walletId}/name").onUpdate((change, context) => {
  console.log("walletNameUpdate start");
  const walletId = context.params.walletId;
  const changed = change.after;
  if (changed.length === 0) {
    change.after = change.before;
  } else if (changed.length > 30) {
    change.after = changed.substring(0, 30);
  }
  walletUpdatedRefresh(walletId);
  // const log = new LogEvent(context, "wallet", walletId)
  // log.write("update Team", "player:" + teamId + PATH_SEPARATOR + playerId + " with " + change.after)
  return change;

});

function walletUpdatedRefresh(walletId) {
  const path_updated = [COLLECTION_WALLETS, walletId, "updated"].join(PATH_SEPARATOR);
  adminDB.ref("/wallets/" + walletId + "/updated").set(currentTM());
}

// exports.teamNameUpdate = functions.database.ref("/wallets/{walletId}/teams/{teamId}/name").onUpdate((change, context) => {
//   console.log("teamNameUpdate start");
//   const walletId = context.params.walletId;
//   const changed = change.after;
//   if (changed.length === 0) {
//     change.after = change.before;
//   } else if (changed.length > 20) {
//     change.after = changed.substring(0, 20);
//   }

//   walletUpdatedRefresh(walletId);
//   // const log = new LogEvent(context, "wallet", walletId)
//   // log.write("update Team", "player:" + teamId + PATH_SEPARATOR + playerId + " with " + change.after)
//   return change;

// });

// exports.playerNameUpdate = functions.database.ref("/wallets/{walletId}/teams/{teamId}/players/{playerId}/name").onUpdate((change, context) => {
//   const walletId = context.params.walletId;
//   // const teamId = context.params.teamId;
//   // const playerId = context.params.playerId;
//   console.log("playerNameUpdate start");

//   const changed = change.after;
//   if (changed.length === 0) {
//     change.after = change.before;
//   } else if (changed.length > 20) {
//     change.after = changed.substring(0, 20);
//   }

//   walletUpdatedRefresh(walletId);
//   // const log = new LogEvent(context, "wallet", walletId)
//   // log.write("update Team", "player:" + teamId + PATH_SEPARATOR + playerId + " with " + change.after)
//   return change;
// });



// FIXME: to remove
// exports.joinwallet = functions.https.onCall(async (data, context) => {
//   const walletId = data.mid;
//   const uid = context.auth.uid;

//   console.log(JSON.stringify(data) + " - retrieve wallets/" + walletId + ",for:" + uid);
//   try {
//     const snap = await adminDB.ref(COLLECTION_WALLETS + "/" + walletId).once("value");
//     if (snap === undefined) {
//       return {};
//     }
//     console.log("add player:" + uid);
//     await snap.ref.child("acl/r/" + uid).set(true);
//     console.log("add wallet " + walletId + " to user" + uid);
//     await adminDB.ref("users/" + uid).child("wallets/" + walletId).set(true);

//     return {
//       key: snap.key,
//       value: snap.val(),
//     };
//   } catch (err) {
//     throw new functions.https.HttpsError("something went wrong", "check the logs");
//   }
// });

// // FIXME: to remove
// exports.joinAsPlayer = functions.https.onCall(async (data, context) => {
//   const variables = data.path;
//   const values = variables.split("|");
//   const walletId = values[0];
//   const teamId = values[1];
//   const playerId = values[2];
//   const uid = context.auth.uid;

//   const path = "/teams/" + teamId + "/players/";
//   console.log(JSON.stringify(data) + " - retrieve wallets/" + path + ",for:" + uid);
//   try {
//     const snap = await adminDB.ref("wallets/" + walletId).once("value");
//     if (snap === undefined) {
//       return {};
//     }
//     console.log("add player:" + uid);
//     const updates = {};
//     updates["acl/r/" + uid] = true;
//     updates["teams/" + teamId + "/players/" + playerId + "/uid"] = uid;
//     await snap.ref.update(updates);
//     console.log("add wallet " + path + " to user" + uid);
//     await adminDB.ref("users/" + uid).child("wallets/" + walletId).set(true);

//     return {
//       key: snap.key,
//       value: snap.val(),
//     };
//   } catch (err) {
//     throw new functions.https.HttpsError("something went wrong", "check the logs");
//   }
// });


exports.beforeSignIn = functions.auth.user().beforeSignIn((userRecord, context) => {
  // console.log("authUser - userRecord:" + userRecord.toJSON());
  // })
  // exports.updateUserBounds = functions.https.onCall((data, context) => {
  console.log("authUser -- start --");

  const uid = userRecord.uid;
  const email = userRecord.email;
  let _displayName = userRecord.displayName;
  if (_displayName === undefined || userRecord.displayName === null) {
    _displayName = "Player";
  }
  const providerId = userRecord.providerData[0].providerId;
  console.log("uid:%s email:%s", uid, email);
  if (email !== undefined) {
    console.log(_displayName);
    _displayName = email.split("@")[0].replace(".", " ");
    userRecord.displayName = _displayName;
  }
  console.log("providerId %s, email:%s, displayName:%s",
    providerId, email, _displayName);
  adminDB.ref(COLLECTION_USERS + PATH_SEPARATOR + uid + PATH_SEPARATOR).update({
    "displayName": _displayName,
    "a": "323023232323",

  });

  return userRecord;
});

// l'utente che clicca sul link chiede di partecipare al gioco.
// aggiorna wallets/walletId/request/uid
// TODO:TO REMOVE
exports.askToJoinwallet = functions.database.ref("/users/{uid}/wallets/{walletId}/requests/")
  .onWrite(async (change, context) => {
    if (!change.before.exists()) {
      const walletId = context.params.walletId;
      // console.log("context:" + JSON.stringify(context));
      const userRef = change.before.ref.parent.parent;
      const name = (await userRef.child("displayName").once("value")).exportVal();
      const avatar = (await userRef.child("info/av").once("value")).exportVal();

      const userInfo = (await userRef.child("info").once("value")).exportVal();
      console.log("userinfo:" + JSON.stringify(userInfo));
      userInfo["name"] = name;
      userInfo["av"] = avatar;
      console.log("parent:" + JSON.stringify(userInfo));
      const uid = context.auth.uid;
      // console.log("request :", walletId, uid, change.after.exportVal());
      // adminDB.ref(COLLECTION_WALLETS).child(walletId).child("acl/r").child(uid).set(true);
      // TODO: valutare se usare una collection ad oc per le richieste. (alleggerire il wallet)
      adminDB.ref(COLLECTION_WALLETS).child(walletId).child("requests").child(uid).set(userInfo);
    }
    if (!change.after.exists()) {
      console.log("askToJoinwallet Deleted node: " + change.before.key);
    } else if (change.before.exists()) {
      console.log("askToJoinwallet Updated node: " + change.after.key);
    } else {
      console.log("askToJoinwallet boh: ");
    }
    return change.after.ref;
  });

// exports.activateRequest = functions.database.ref("/joinReq/{uid}/{shareLinkID}").onCreate((snap, context) => {

//     const shareLinkID = context.params.shareLinkID;
//     console.log("look for :" + shareLinkID);
//     const uid = context.auth.uid;

//     adminDB.ref(COLLECTION_WALLETS).orderByChild("sl").equalTo(shareLinkID).limitToFirst(1).get().then((snap) => {
//         const wallets = snap.val();

//         // console.log(JSON.stringify(snap.val()));
//         if (wallets === undefined || wallets === null) {
//             return;
//         }
//         const walletId = Object.keys(wallets)[0];
//         const wallet = wallets[walletId];
//         var updates = {};
//         updates["wallets/" + walletId + "/acl/r/" + uid] = true;
//         updates["joinReq/" + uid + PATH_SEPARATOR + shareLinkID + "/c"] = currentTM();
//         updates["joinReq/" + uid + PATH_SEPARATOR + shareLinkID + "/gid"] = walletId;
//         updates["joinReq/" + uid + PATH_SEPARATOR + shareLinkID + "/t"] = wallet.name;
//         updates["joinReq/" + uid + PATH_SEPARATOR + shareLinkID + "/k"] = wallet.rules.pvp;
//         updates["walletstats/" + uid + PATH_SEPARATOR + walletId + "/req"] = shareLinkID;

//         console.log("updates: " + JSON.stringify(updates));
//         adminDB.ref().update(updates);
//     });
//     return snap.ref
// });

// todo: To delete
// exports.subonMatch = functions.database.ref("/users/{uid}/wallets/{walletId}/{teamId}/{playerId}/").onCreate((snap, context) => {
//     console.log("subonMatch -- start --");
//     const walletId = context.params.walletId;
//     const teamId = context.params.teamId;
//     const playerId = context.params.playerId;
//     const uid = context.auth.uid;

//     console.log("request: ", walletId, teamId, playerId);
//     console.log(context.auth);
//     const path_player = [COLLECTION_WALLETS, walletId, VAR_TEAMS,teamId,VAR_PLAYERS,playerId].join(PATH_SEPARATOR);
//     adminDB.ref(path_player).set(uid);
//     return snap.ref;
// });


exports.cleanTitle = functions.database.ref("/wallets/{walletId}/name}").onWrite((change, context) => {
  console.log("cleanTitle -- start --");
  change.after;
  return change.after.ref;
});



/**
 * wallet SHARE LOGIC
 */


/** 
 * wallet SHARE - STEP 1 - LINK CREATION
 */
exports.walletshareCreate = functions.database.ref("/wallets/{walletId}/sl/").onWrite((change, context) => {
  // const uid = context.auth.uid;
  console.log("walletshareCreate -- start --");

  console.log(JSON.stringify(change));
  // const slink = change.after.val();
  const walletId = context.params.walletId;

  adminDB.ref(COLLECTION_WALLETS).child(walletId).child("slCreated").set(currentTM());
  return change.ref;
});


/*
SHARE wallet STEP 2
- recupero il wallet dallo sharedlinkID
- aggiorno l'acl/r del wallet con lo userId

=> il player adesso può vedere il wallet e scegliere il giocatore con cui joinare
*/
exports.usersSavewalletshareLink = functions.database.ref("/users/{uid}/joinreq/{sl}").onWrite(async (snap, context) => {
  const sharedLinkID = context.params.sl;
  const uid = context.auth.uid;
  console.log("usersSavewalletshareLink -- start --");
  console.log("request: ", uid, sharedLinkID);
  await adminDB.ref(COLLECTION_WALLETS).orderByChild("sl").equalTo(sharedLinkID).limitToFirst(1).get().then(async (snap) => {
    const wallets = snap.val();

    // console.log(JSON.stringify(snap.val()));
    if (wallets === undefined || wallets === null) {
      return snap.ref;
    }
    const walletId = Object.keys(wallets)[0];
    const wallet = wallets[walletId];
    const updates = {};

    updates[COLLECTION_WALLETS + PATH_SEPARATOR + walletId + "/acl/r/" + uid] = true;

    const walletJoinReqPath = [COLLECTION_USERS, uid, "joinreq", sharedLinkID, "id"].join(PATH_SEPARATOR);
    updates[walletJoinReqPath + "/id"] = walletId;
    console.log("updates: " + JSON.stringify(updates));
    await adminDB.ref().update(updates);

    return snap.ref;
  });
  return snap.ref;
});
exports.userjoinedWallet = functions.database.ref("/wallets/{walletId}/acl/r/{uid}").onWrite(async (change, context) => {
  var nextVal = change.after.val();
  var authId = context.params.uid;
  if (nextVal !== undefined && nextVal === true) {
    adminDB.ref(COLLECTION_JOINREQUEST).child(authId).child(walletId).remove()
    return change;
  }
});
// USER SELECT the player on thje wallet joined
exports.joinwalletAsPlayer = functions.database.ref("/wallets/{walletId}/teams/{teamId}/players/{playerId}/u").onWrite(async (change, context) => {
  if (context.authType !== undefined && context.authType === "ADMIN") {
    return change.before;
  }
  const uid = context.auth.uid;
  console.log("user:" + uid);
  const walletId = context.params.walletId;
  const teamId = context.params.teamId;
  const playerId = context.params.playerId;
  const changed = change.after;
  console.log("changed:" + changed);

  // aggiorno il nome e l'avatar con quelli dell'utente che si unisce al wallet
  if (changed !== undefined && changed !== null && changed.val() !== null) {
    console.log("joinwalletAsPlayer - lookFor:" + changed.val());

    const userSnap = await adminDB.ref(COLLECTION_USERS).child(changed.val()).once("value");

    if (userSnap !== undefined || userSnap !== null) {
      console.log("joinwalletAsPlayer - snap:" + JSON.stringify(userSnap));
      const user = userSnap.val();
      const updates = {
        "name": user["displayName"],
        "a": user["a"],
      };
      const path_playerOnwallet = [COLLECTION_WALLETS, walletId, VAR_TEAMS, teamId, VAR_PLAYERS, playerId].join(PATH_SEPARATOR);
      console.log("path:" + path_playerOnwallet, "set", updates);
      await adminDB.ref(path_playerOnwallet).update(updates);


    }

    const sharedlinkSnap = await adminDB.ref(COLLECTION_WALLETS).child(walletId).child("sl").once("value");
    if (sharedlinkSnap !== undefined && sharedlinkSnap !== null) {
      const sharedlinkID = sharedlinkSnap.val();
      const path_joinReq_player = [COLLECTION_JOINREQUEST, uid, sharedlinkID].join(PATH_SEPARATOR)
      await adminDB.ref(path_joinReq_player).remove();

    }

  }
  return change;
});

/* ==== **** ===== */

const fld_quantity = "q";
const fld_amount = "a";
const fld_type = "t";
const fld_user = "u";
const fld_created = "dc";
const fld_walletId = "wid";
const fld_spent = "s";
const fld_paid = "p";
const fld_quota = "q";
const fld_debitors = "debs";
const fld_creditor = "cred";
const fld_members = "quotas";

function trxFromSnap(map, key) {
  try {

    return new TrxObj(key,
      map.t,
      map.debs,
      {"a": map.q["a"], "t":map.q['t'] },
      map.qt,
      map.a,
      map.cred
    );
  } catch (err) {
      console.error(key,err)
  }
}

exports.walletUpdateQuotas = functions.database.ref("/wallets/{walletId}/updQuota/").onWrite((change, context) => {
  // const uid = context.auth.uid;


  // const slink = change.after.val();
  const walletId = context.params.walletId;
  console.log("walletUpdateQuotas -- START --", walletId);
  console.log("walletUpdateQuotas -- START --", COLLECTION_TRANSACTIONS, PATH_SEPARATOR, walletId);

  adminDB.ref(COLLECTION_WALLETS).child(walletId).child("quotas").once('value', (snap, _) => {
    console.log(snap.ref);
    return snap.val();

  }).then((value) => {
    console.log("quotas", value.val());
    var members = {}
    for (const k in value.val()) {
      members[k] = new WalletMember(k, 0, 0, 0);
    }
    adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).once('value', (snap, _) => {
      // console.log("walletUpdateQuotas trxList:", snap.val());
      const trxList = snap.val();

      if (trxList === undefined || trxList === null) return;
      // console.log(trxList === undefinedObject.entries(trxList).size)
      const updatesMember = walletQuotasCalculate(walletId, trxList);
      var updates = {"trxCount":trxList.length}
      for (const k in members) {
        var memberValues = updatesMember[k];
        if (memberValues === undefined) {
          memberValues = members[k];
        }
        for (const f in memberValues) {
          const fieldValue = memberValues[f]
          updates["quotas/" + k + "/" + f] = fieldValue;
        }
      }

      console.log("walletUpdateQuotas - updates", updates);
      adminDB.ref(COLLECTION_WALLETS).child(walletId).update(updates)


      // adminDB.ref(COLLECTION_WALLETS).child(walletId).child("slCreated").set(currentTM());

    });

  });

  return change.after.ref;
});

exports.trxUpdate = functions.database.ref("/transactions/{walletId}/{trxId}").onUpdate((snap, context) => {

    console.log("trxUpdate", "START")
    var walletId = context.params.walletId;
    // console.log("snap: " + JSON.stringify(snap));
    // console.log("context: " + JSON.stringify(context));

    var before = snap.before.val();
    var updated = snap.after.val();
    const currTrx = trxFromSnap(before, snap.key)

    const nextTrx = trxFromSnap(updated, snap.key)
    trxUpdateToWallet(walletId, currTrx, nextTrx)
    return snap;
  });

exports.trxDelete = functions.database.ref("/transactions/{walletId}/{trxId}").onDelete((snap, context) => {
  console.log(JSON.stringify(snap.val()));
  const _walletId = context.params.walletId;
  const trx = trxFromSnap(snap.val());

  const updates = calculate(trx).walletUPD;
  var finalupdates = {};
  for (const key in updates) {
    const member = updates[key].subtract();
    finalupdates[key] = member;
  }
  console.log(finalupdates);

  updateWalletQuotaLast(_walletId, finalupdates);
  return snap;
})


exports.trxCreate = functions.database.ref("/transactions/{walletId}/{trxId}").onCreate((snap, context) => {
    const _walletId = context.params.walletId;
    const _trxId = context.params.trxId;
    var newKey = snap.key;
    var newVal = snap.val();


    var updates = {}
    if (newVal.qt === undefined || newVal.qt === 0) {
      updates["qt"] = 1.0;
      // snap.ref.child(["qt"]).set(1.0);
    }
    if (newVal.a === undefined) {
      updates["a"] = 0.0;
      // sna.ref.child(fld_amount).set(0.0);
    }
    if (newVal.t === undefined) {
      updates[[fld_type]] = "item";
      // snap.ref.child("f").set("item");
    }
    const nextTrx = trxFromSnap(newVal, newKey)
    console.log("created: ", {
      [_walletId]: {
        [_trxId]: newVal
      }
    });
    console.log("created: ", {
      [_walletId]: {
        [_trxId]: nextTrx
      }
    });



    const res = calculate(nextTrx);
    // if (res.quota !== newVal.q.a) {
    //   console.log("aggiorno la quota da", newVal.q.a, "a", res.quota);
    //   updates["q/a"] = res.quota;
    //   snap.ref.child("q/a").set(res.quota);
    // }
    console.log("updates", updates)
    // snap.ref.update(updates);
    updateWalletQuotaLast(_walletId, res.walletUPD)
    return snap;
  });

// exports.eventQuotaUpdate = functions.database.ref("/wallet/{walletId}/quotas/{mId}")
//   .onUpdate((snap, context) => {

//   });
function updateWalletQuotaLast(walletId, nextMembers) {
  adminDB.ref(COLLECTION_WALLETS).child(walletId).once('value', (snap, str) => {
    const currMembers = snap.val()['quotas']

    // console.log("updateWalletQuotaLast START", currMembers,nextMembers);

    var finalMemberUpdates = {}
    for (const key in currMembers) {
      console.log("updateWalletQuotaLast LOOP", key);
      const currM = currMembers[key];
      const nextM = nextMembers[key];
      // console.log("updateWalletQuotaLast LOOP curr", key, currM);
      // console.log("updateWalletQuotaLast LOOP next", key, nextM);
      // console.log("updateWalletQuotaLast LOOP", key, currM.quota, nextM.q, currM.quota + nextM.q);

      const prefix = "quotas/" + key;
      if (nextM !== undefined) {

        // if (trxType === 'item') {
        finalMemberUpdates[prefix + "/p"] = currM.p + nextM.p;
        finalMemberUpdates[prefix + "/s"] = currM.s + nextM.s;
        // }
        finalMemberUpdates[prefix + "/q"] = currM.q + nextM.q;
        finalMemberUpdates[prefix + "/m"] = currM.m + nextM.m;
      } else {
        finalMemberUpdates[prefix + "/p"] = currM.p;
        finalMemberUpdates[prefix + "/s"] = currM.s;
        // }
        finalMemberUpdates[prefix + "/q"] = currM.q;
        finalMemberUpdates[prefix + "/m"] = currM.m;

      }

    }
    console.log("updateWalletQuotaLast FINAL", finalMemberUpdates);
    snap.ref.update(finalMemberUpdates);
    // .update(finalMemberUpdates);
  })

}

function fixTransaction(currTrx) {
  const quotaCurr = currTrx.q.amount;
  var parts = 0
  for (const key in currTrx.debs) {
    parts += currTrx.debs[key];
  }
  const trxAmount = currTrx.a;
  var quotaNext = trxAmount / parts;
}

function round2Dec(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100

}

function round3Dec(num) {
  return (Math.round((num) * 100000) / 100000)

}



function calculate(currTrx) {

  const trxId = currTrx.uid;
  const trxType = currTrx.t;
  const credKey = currTrx.cred;
  const paid = round3Dec(currTrx.a * currTrx.qt);
  var parts = 0
  for (const key in currTrx.debs) {
    parts += currTrx.debs[key];
  }

  if (currTrx.qt > 1) console.info(trxId, "QUANTITY CHECK", currTrx.qt)

  var updatesMember = {};
  var quotaCheck = 0.0;
  if (trxType == 'item') {
    // calculate basequota
    updatesMember[credKey] = new WalletMember(credKey, paid, 0, 0);
    var quotaAmount = round3Dec(paid / parts);
    if (quotaAmount !== round3Dec(currTrx.q.a)) console.warn(trxId, "QUOTA DIVERSA QUELLA REGISTRATA", quotaAmount, currTrx.q.a, currTrx.qt + "*" + paid +"*"+ parts, );
    for (const key in currTrx.debs) {

      const part = currTrx.debs[[key]];
      const debt = round3Dec(part * quotaAmount);
      quotaCheck += debt;
      var result = new WalletMember(key, 0, debt, 0);
      if (updatesMember.hasOwnProperty(key)) {
        result = new WalletMember(key, paid, debt, 0);
      }
      result.trx += 1
      updatesMember[key] = result;
    }
    const delta = round3Dec(paid) - round3Dec(quotaCheck)
    if (Math.abs(delta) > 0.01) console.error(trxId, "PAID != quote sum", paid, quotaCheck, delta)

  } else {
    var idx = 0;
    for (const key in currTrx.debs) {
      idx += 1;
      updatesMember[key] = new WalletMember(key, 0, 0, paid);
    }
    if (idx > 1) console.error(trxId, "MOVE - more debs", paid, quotaCheck, delta)
    updatesMember[credKey] = new WalletMember(credKey, 0, 0, -paid);
  }

  var checkM = new WalletMember("checkM", 0, 0, 0)
  for (const k in updatesMember) {
    const m = updatesMember[k];
    checkM.add(m);
  }
  if (checkM.q > 0)
    console.log("CHECKM", trxId, checkM.toMap());

  // if (quotaAmount !== round3Dec(currTrx.q.a))
  //   console.error("QUOTA NON CORRETTA", currTrx.uid, quotaAmount, currTrx.q.a);
  // console.log("calculate", [currTrx.uid, trxType, currTrx.qt + "*" + trxAmount, parts, quotaAmount, currTrx.cred ]);


  // console.log("calculate endloop ", trxType, updatesMember)
  return {
    "walletUPD": updatesMember,
    "quota": (quotaAmount !== round3Dec(currTrx.q.a)) ? quotaAmount : 0,
  };
}

function trxUpdateToWallet(walletId, currTrx, nextTrx) {
  const currCalc = calculate(currTrx).walletUPD;
  const nextCalc = calculate(nextTrx).walletUPD;
  console.log("trxUpdateToWallet START calc", currCalc, nextCalc);

  var currDebitors = currTrx.debs;
  var nextDebitors = nextTrx.debs;
  nextDebitors = trxDebsRemove(currDebitors, nextDebitors);
  var updatesMember = {};
  for (const key in nextDebitors) {
    console.log("curr",key, JSON.stringify(currCalc[key]));
    console.log("next",key, JSON.stringify(nextCalc[key]));
    if (currCalc[key] === undefined) {
      currCalc[key] = new WalletMember(0, 0, 0, 0);
    }
    if (nextCalc[key] === undefined) {
      nextCalc[key] = new WalletMember(0, 0, 0, 0);
    }
    const currS = currCalc[key].hasOwnProperty('s') ? currCalc[key].s : 0;
    console.log("updateWalletQuotaLast LOOP", key, currS, nextCalc[key].s, currS - nextCalc[key].s);
    const paid = nextCalc[key].p - currCalc[key].p;
    const debt = nextCalc[key].s - currS;
    const move = nextCalc[key].m - currCalc[key].m;
    updatesMember[key] = new WalletMember(key, paid, debt, move);


  }
  console.log("trxUpdateToWallet", updatesMember)
  updateWalletQuotaLast(walletId, updatesMember);
}

function walletQuotasCalculate(walletId, trxList) {
  var updatesMember = {};
  var updatesTrxQuota = {};
  console.log("walletQuotasCalculate - START ");
  var cc = 0;
  for (const trxId in trxList) {
    cc += 1;
    const nextTrx = trxFromSnap(trxList[trxId], trxId);
    
    // console.log("check", nextTrx.q, JSON.stringify(trxList[trxId]))
    const trxType = nextTrx.t;
    const calcolo = calculate(nextTrx);
    if (calcolo.quota > 0) {
      adminDB.ref(COLLECTION_TRANSACTIONS).child(walletId).child(trxId).child("q/a").set(calcolo.quota)
    }
    const nextCalc = calcolo.walletUPD;
    
    for (const key in nextCalc) {

      // console.log("walletQuotasCalculate LOOP", key)
      var prevCalc = new WalletMember(key, 0, 0, 0,cc);
      if (updatesMember.hasOwnProperty(key)) {
        prevCalc = updatesMember[key];
      }


      const paid = prevCalc.p + nextCalc[key].p;
      const debt = prevCalc.s + nextCalc[key].s;
      const move = prevCalc.m + nextCalc[key].m;

      updatesMember[key] = new WalletMember(key, paid, debt, move,cc);

      // if (key === "0xDwg3qHwj") {
      //   console.log("walletQuotasCalculate LOOP", cc, "fine", key, updatesMember[key])
      // }
    }
    // console.log("===========================");
    // for (const k in updatesMember) {
    //   console.log("walletQuotasCalculate END", updatesMember)

    // }

  }
  return updatesMember;
}
///==============================================
function getWalletQuotaUpdate(currTrx, nextTrx) {

  const finalEventUpdate = {};
  console.log("getWalletQuotaUpdate start");
  console.log({
    "curr": currTrx,
    "next": nextTrx
  });

  for (const key in nextTrx.debs) {
    console.log(key, {
      [key]: nextTrx.debs
    });

    const walletMember = new WalletMember(key, 0, 0, 0);

    console.log("getWalletQuotaUpdate: values", {
      [key]: walletMember
    });
    if (!nextTrx.debs.hasOwnProperty(key)) {
      continue;
    }
    console.log(nextTrx.debs[[key]], nextTrx.q)
    const nextQuotaDebit = nextTrx.debs[[key]] * nextTrx.q.a;
    const currQuotaDebit = getMapVal(currTrx.debs, [key], 0.0) * currTrx.q.a;
    console.log({
      "nextQuotaDebit": nextQuotaDebit,
      "currQuotaDebit": currQuotaDebit
    });

    // OK
    console.log("getWalletQuotaUpdate:", key, ":", currTrx.debs[[key]], " > ", nextTrx.debs[[key]] +
      " from:", currQuotaDebit, " > ", nextQuotaDebit,
      " =", (nextQuotaDebit - currQuotaDebit)
    );

    walletMember.q = round3Dec(nextQuotaDebit - currQuotaDebit);


    finalEventUpdate[key] = walletMember;
  }
  return finalEventUpdate

}
class WalletMember {
  /**sss */
  uid = "";
  p = 0.0;
  s = 0.0;
  q = 0.0;
  m = 0.0;
  trx = 0;

  constructor(uid, p, s, m,trx = 0) {
    this.uid = uid;
    this.p = round3Dec(p);
    this.s = round3Dec(s);
    this.m = round3Dec(m);
    this.q = round3Dec(p - s + m);
    this.trx = trx;
  }
  subtract() {
    this.p *= -1;
    this.s *= -1;
    this.m *= -1;
    this.q *= -1;
    return this;
  }
  add(member) {
    // console.log("add", member);
    this.p += round3Dec(member.p);
    this.s += round3Dec(member.s);
    this.m += round3Dec(member.m);
    this.q = round3Dec(this.p - this.s + this.m);
    this.trx += 1;
    // console.log("add end ", this);
  }
  toMap() {
    return {
      "p": this.p,
      "s": this.s,
      "m": this.m,
      "q": this.q,
      "trx":this.trx
    };
  }
  toStr() {
    return [this.uid, this.p, this.s, this.m, this.q];
  }
}
class TrxObj {
  uid = "";
  debs = {};
  q = {
    t: "parts",
    a: 0.0
  };
  qt = 1.0;
  a = 0.0;
  cred = "";
  t = "item";
  constructor(uid, type, debs, quota, quantity, amount, creditor) {
    this.uid = uid;
    this.t = type;
    this.debs = debs;
    this.a = round3Dec(amount);
    this.cred = creditor;
    this.q = quota;
    this.q.a = round3Dec(quota['a'])
    this.qt = quantity;
  }
  getAmountQT() {
    return round3Dec(this.qt * this.q.a);
  }

}

/** aggiorna i debs destinazione rimuovendo dal vecchiio queeli non più presenti */
function trxDebsRemove(currDebitors, nextDebitors) {
  const oldKeys = Object.keys(currDebitors)
  const updKeys = Object.keys(nextDebitors)

  console.log("trxDebsRemove", JSON.stringify(oldKeys), JSON.stringify(updKeys), )
  const filteredKeys = oldKeys.filter(x => !updKeys.includes(x))
  if (filteredKeys.length > 0) {
    for (var ko in oldKeys) {
      console.log(oldKeys[ko], "-> 0")
      nextDebitors[oldKeys[ko]] = 0.0
    }

  }
  console.log("updDebitors:" + JSON.stringify(nextDebitors))

  return nextDebitors
}

function trxUpdateQuota(currTrx, nextTrx) {
  console.log("trxUpdateQuota", "START")

  const currQuotaAmount = currTrx.q.a;
  var totalParts = 0.0
  for (var k1 in nextTrx.debs) {
    if (nextTrx.debs.hasOwnProperty(k1)) {
      totalParts += nextTrx.debs[k1]
    }
  }
  // const currQuota = before["q"];
  // const nextQuota = updated["q"];
  // aggiorno la quota base
  const nextQuotaAmount = nextTrx.a / totalParts

  if (nextQuotaAmount === currQuotaAmount) {
    return currQuotaAmount;
  }

  console.log("before:", JSON.stringify(currTrx.debs))
  console.log("updated:", JSON.stringify(nextTrx.debs))
  console.log("oldQuota:", currTrx.qt, " * ", currTrx.q.a)
  return nextQuotaAmount;
}



function updateTrxValues2Delete(currTrx, nextTrx) {
  console.log("updateWalletQuota", "START")


  nextTrx.debs = trxDebsRemove(currTrx.debs, nextTrx.debs);
  console.log({
    "currDebitors": nextTrx.debs
  })
  console.log({
    "nextDebitors": currTrx.debs
  })


  // nextTrx.q.a = trxUpdateQuota(nextTrx.debs, currTrx.q, nextTrx.q);
  nextTrx.q.a = trxUpdateQuota(currTrx, nextTrx);
  const path = fld_quota + "/" + fld_amount;
  console.log({
    "path": path,
    "amount ": nextTrx.q.a
  });
  // snap.after.ref.child(path).set(nextTrx.q.a); // TOFIX: posso farlo in altro punto? // TOFIX

  console.log({
    "quota": {
      "from": currTrx.getAmountQT(),
      "to": nextTrx.getAmountQT()
    }
  });


  var finalEventUpdate = getWalletQuotaUpdate(currTrx, nextTrx);

  console.log({
    "finalEventUpdate": finalEventUpdate
  });

  finalEventUpdate = updateWalletCreditor(finalEventUpdate, currTrx.cred, nextTrx.cred);
  console.log({
    "finalEventUpdate": finalEventUpdate
  });

  updateWalletQuota(walletId, finalEventUpdate)
}

function updateWalletCreditor(finalWalletQuota, currCreditor, nextCreditor) {
  if (nextCreditor === currCreditor) {
    return;
  }
  console.log("update paid nextCreditor: (" + nextCreditor + ") " + JSON.stringify(finalWalletQuota[nextCreditor]))
  if (finalWalletQuota[nextCreditor] === undefined) {
    finalWalletQuota[nextCreditor] = {}
  }
  finalWalletQuota[nextCreditor]["p"] = updated["a"]
  console.log("update paid currCreditor: (" + currCreditor + ") " + JSON.stringify(finalWalletQuota[currCreditor]))
  if (finalWalletQuota[currCreditor] === undefined) {
    finalWalletQuota[currCreditor] = {}
  }
  finalWalletQuota[currCreditor]["p"] = 0.0 - before["a"]

  return finalWalletQuota
}

function getMapVal(map, key, def) {
  console.log("getMapVal", key, typeof (map))

  if (!map.hasOwnProperty(key) || map[key] == null || map[key]) return def;
  return map[key];
}

function updateWalletQuota(walletId, finalEventUpdate) {
  console.log("updateWalletQuota", "START")
  const ref = adminDB.ref(COLLECTION_WALLETS).child(walletId)

  ref.child(fld_members).once("value")
    .then(snap => {
      if (snap.val() === undefined || snap.val() === null) {
        console.error("transaction not found")
        // var p = new Promise();
        // p.reject(walletId + " - " + " transaction not found");
        return;
      }
      console.log("updateWalletQuota", "START 4 REAL");
      const quotaMap = snap.val();
      var toUpdate = {}
      for (var curr in finalEventUpdate) {
        if (
          !quotaMap.hasOwnProperty(curr) ||
          !finalEventUpdate.hasOwnProperty(curr)
        ) {
          continue;
        }
        const LOG_PREFIX = "updateWalletQuota: (" + curr + ") "
        var quotaKey = fld_members + "/" + curr
        const walletMemberCurrent = quotaMap[curr];
        const walletMemberUpdate = finalEventUpdate[curr];
        console.log(LOG_PREFIX, {
          curr: finalEventUpdate[curr]
        });


        const currSpent = getMapVal(walletMemberCurrent, "s", 0.0)
        const oldPaid = getMapVal(walletMemberCurrent, "p", 0.0)
        const oldQuota = getMapVal(walletMemberCurrent, "q", 0.0)

        const updSpent = getMapVal(walletMemberUpdate, "s", 0.0)
        const updPaid = getMapVal(walletMemberUpdate, "p", 0.0)
        const updQuota = getMapVal(walletMemberUpdate, "q", 0.0)

        console.log(LOG_PREFIX + "quotaMap " + JSON.stringify(walletMemberCurrent))
        console.log(LOG_PREFIX + "spent " + updSpent)
        toUpdate[quotaKey + "/s"] = currSpent + updSpent

        console.log(LOG_PREFIX + "paid " + updPaid)
        toUpdate[quotaKey + "/p"] = oldPaid + updPaid

        console.log(LOG_PREFIX + "quota:  " + oldQuota + " -> " + updPaid + " | " + updSpent)
        toUpdate[quotaKey + "/" + "q"] = oldQuota + updPaid + updSpent

        console.log(LOG_PREFIX, {
          "toUpdate": toUpdate
        });

      }
      console.log("updateWalletQuota " + "updates: " + walletId + " -> " + JSON.stringify(toUpdate))

      return adminDB.ref(COLLECTION_WALLETS + "/" + walletId).update(toUpdate)
    })
    .catch(err => {
      console.error(err);
    });
}