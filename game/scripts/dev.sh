#!/usr/bin/env bash
set -euo pipefail

# Local dev loop:
#   1. boot the Firestore emulator on the demo-whisker-wings project (data wiped each run)
#   2. seed it with a few leaderboard entries, since that wipe leaves it empty
#   3. start Vite pointed at the emulator (VITE_APP_ENV=dev)
# Ctrl+C tears the whole thing down — emulators:exec cleans up when Vite exits.
#
# The "demo-" project prefix is reserved by Firebase and means the emulator runs
# fully offline: no credentials, no real project, nothing to configure on a fresh
# clone. Only Firestore — this game has no auth.

cd "$(dirname "$0")/.."

npx firebase emulators:exec \
  --only firestore \
  --project demo-whisker-wings \
  "node scripts/seed.mjs && VITE_APP_ENV=dev npm run vite"
