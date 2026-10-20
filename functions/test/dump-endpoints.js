"use strict";
// Stampa su stdout gli endpoint (nome -> metadati di deploy) esportati da index.js, senza collegarsi a Firebase.
process.env.GCLOUD_PROJECT = "demo-splixy";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-splixy",
  databaseURL: "https://demo-splixy-default-rtdb.firebaseio.com",
});

const mod = require("../index.js");
const out = {};
for (const name of Object.keys(mod).sort()) {
  const fn = mod[name];
  out[name] = (fn && fn.__endpoint) ? JSON.parse(JSON.stringify(fn.__endpoint)) : `non-endpoint:${typeof fn}`;
}
console.log(JSON.stringify(out, null, 2));
