#!/bin/sh
# cut + measure + playtester brief. usage: tools/release.sh <N> <commit-message-file>
set -e
cd "$(dirname "$0")/.."
tools/cut.sh "$1" "$2"
node tools/run-swarm.mjs
node tools/review-pack.mjs "$1" >/dev/null
