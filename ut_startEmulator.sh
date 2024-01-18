#/bin/bash
firebase emulators:start --only auth,storage,database,functions,hosting,pubsub --import ./export --export-on-exit


