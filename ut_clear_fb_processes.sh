#!/bin/bash

xx=$(lsof -i -P | grep LISTEN | grep :$PORT | egrep "(4000|9000|9001|8080|9199)" | sed -E 's/ {1,}/-/g' | cut -d"-" -f2)
for p in ${xx[@]}; do
    echo "killing process $p"
    kill -9 $p
done