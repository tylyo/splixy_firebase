# CLAUDE.md — Splixy (backend Firebase)

Backend dell'app Splixy (repo app: `../application`).

## Contenuto

- `database.rules.json` — regole Realtime Database (il progetto usa **Realtime Database**, non Firestore)
- `storage.rules` — regole Storage
- `functions/index.js` — Cloud Functions (Node 20)
- `public/` — hosting: pagine privacy, termini, supporto

## Comandi

- Emulatori: `./ut_startEmulator.sh` (auth, storage, database, functions, hosting; importa ed esporta `./export`)
- Deploy functions: `npm run deploy` in `functions/`

## Cose a cui prestare attenzione

- Le chiavi abbreviate dei nodi DB devono restare allineate ai `@JsonKey` dei model Dart dell'app
- Ogni modifica a model/permessi lato app va riflessa in `database.rules.json`
- Export dell'emulatore e del DB contengono dati reali: non versionarli
