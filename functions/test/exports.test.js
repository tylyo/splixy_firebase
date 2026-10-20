"use strict";

/**
 * Le functions già in produzione devono mantenere nome e trigger: Firebase altrimenti le cancella e le
 * ricrea, e l'app richiama alcune per nome (es. memberAddToAll).
 * expected-endpoints.json è stato generato dall'index.js monolitico prima della divisione in moduli.
 *
 * Se aggiungi/modifichi una function di proposito rigenera il file:
 *   node test/dump-endpoints.js > test/expected-endpoints.json
 */

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const path = require("node:path");

describe("endpoint esportati da index.js", () => {
  it("sono identici a quelli in produzione", () => {
    const out = execFileSync(process.execPath, [path.join(__dirname, "dump-endpoints.js")], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const actual = JSON.parse(out);
    const expected = require("./expected-endpoints.json");

    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "nomi delle functions cambiati");
    for (const name of Object.keys(expected)) {
      assert.deepEqual(actual[name], expected[name], `trigger di ${name} cambiato`);
    }
  });
});
