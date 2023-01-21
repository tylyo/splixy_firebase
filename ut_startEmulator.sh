#/bin/bash
firebase emulators:start --only auth,storage,database,functions,hosting --import ./export --export-on-exit


