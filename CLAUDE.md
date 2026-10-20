# CLAUDE.md — Splixy (backend Firebase)

Backend dell'app Splixy (repo app: `../application`).

## Contenuto

- `database.rules.json` — regole Realtime Database (il progetto usa **Realtime Database**, non Firestore)
- `storage.rules` — regole Storage
- `functions/` — Cloud Functions (Node 20), divise in moduli (`index.js` inizializza l'SDK e li ri-esporta):
  - `auth.js` (authUser), `users.js` (updateAuthUser), `wallets.js`, `join.js` (condivisione e ingresso/uscita), `transactions.js` (trxCreate/Update/Delete), `members.js` (memberRemove, memberAddToAll)
  - `calculations.js` (calcolo delle quote, solo logica pura), `walletQuotas.js` (scrittura delle quote), `notifications.js` (push FCM), `models.js`, `commons.js` (costanti e helper)
  - `accountDeletion.js` (eliminazione account in due fasi come matrimoni: `deleteUser` callable → archivia in `/usersDeleted`, disabilita l'utente; `purgeDeletedUsers` ogni 24 ore dopo 30 giorni toglie l'utente dai wallet e lo elimina da Auth; `requestAccountDeletion` HTTP per la pagina web, raggiunta da `/api/requestAccountDeletion`) e `accountCleanup.js` (logica pura sui wallet, non esportata). Un partecipante (`quotas/{id}`) non va mai eliminato: `memberRemove` ricalcolerebbe i saldi degli altri. La cancellazione definitiva non parte negli emulatori senza pubsub: si prova con `purgeDeletedUsers.run({}, {})` da uno script Node
  - le functions sono esportate **piatte** (`Object.assign(exports, require(...))`) e non a gruppi come in matrimoni: con `exports.gruppo = require(...)` Firebase le rinominerebbe in `gruppo-nome`, cancellando e ricreando quelle già in produzione e richiamate dall'app
- `public/` — hosting: sito (landing IT/EN, supporto, privacy, termini, eliminazione account). Le pagine sono **generate** da `site/` (`python3 site/build.py`; immagini con `site/make_images.py`, richiede Pillow): non modificarle a mano
  - `/privacy.{it,en}`, `/terms.{it,en}`, `/support.{it,en}` sono **frammenti HTML senza `<html`** perché `attilio_lib` li scarica e li mostra nell'app scartando le risposte con `<html`; le pagine web complete stanno a `/privacy`, `/it/privacy` ecc.

## Comandi

- Emulatori: `./ut_startEmulator.sh` (auth, storage, database, functions, hosting; importa ed esporta `./export`)
- Test functions: `npm test` in `functions/`. `test/expected-endpoints.json` blocca nomi e trigger delle functions in produzione: se ne aggiungi una di proposito rigeneralo con `node test/dump-endpoints.js > test/expected-endpoints.json`
- Deploy functions: `npm run deploy` in `functions/`

## Cose a cui prestare attenzione

- Le chiavi abbreviate dei nodi DB devono restare allineate ai `@JsonKey` dei model Dart dell'app
- Ogni modifica a model/permessi lato app va riflessa in `database.rules.json`
- Export dell'emulatore e del DB contengono dati reali: non versionarli
- Nell'emulatore con `singleProjectMode` il namespace del database è l'ID progetto (es. `ns=demo-splixy`), non `...-default-rtdb`: scrivere sull'altro non fa scattare i trigger
