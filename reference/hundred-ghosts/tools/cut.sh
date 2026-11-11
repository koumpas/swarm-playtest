#!/bin/sh
# Cut a version: snapshot sim.js to versions/vN.js, commit everything, tag vN.
# usage: tools/cut.sh <N> <commit-message-file>
set -e
cd "$(dirname "$0")/.."
N="$1"; MSG="$2"
grep -q "const VERSION = $N;" sim.js || { echo "sim.js VERSION is not $N"; exit 1; }
cp sim.js "versions/v$N.js"
git add -A
git commit -q -F "$MSG"
git tag "v$N"
git log --oneline -1
