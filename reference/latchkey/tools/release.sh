#!/bin/sh
# cut (commit + tag) FIRST, then measure, then write the playtester brief, then commit the measurement.
# usage: tools/release.sh <N> <commit-message-file>
set -e
cd "$(dirname "$0")/.."
tools/cut.sh "$1" "$2"
node tools/run-swarm.mjs
node tools/review-pack.mjs "$1" >/dev/null
# The tag vN is the game as it was before it was measured. The log, the screenshots and the brief go into
# a second commit, so that they are not mixed into the commit of version N+1 and the last version is not left out.
git add -A log shots
git commit -q -m "v$1: measurement record (no game change)"
