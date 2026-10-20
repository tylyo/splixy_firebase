"use strict";
const admin = require("firebase-admin");

admin.initializeApp();

// Le functions sono esportate "piatte" (senza gruppo): i nomi già in produzione e richiamati dall'app
// (es. memberAddToAll) restano invariati. Con `exports.gruppo = require("./modulo")` come in matrimoni
// Firebase le rinominerebbe in `gruppo-nomeFunzione`, cancellando e ricreando quelle esistenti.
Object.assign(exports,
    require("./auth"),
    require("./users"),
    require("./wallets"),
    require("./join"),
    require("./transactions"),
    require("./members"),
);
