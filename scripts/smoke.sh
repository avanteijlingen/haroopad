#!/usr/bin/env bash
# Runs the Electron smoke test and prints its report.
# Usage: ./scripts-smoke.sh [extra electron args]
# Env:   HAROOPAD_SMOKE_EVAL='<js>'  evaluate in the pad window and print as "eval"
#        HAROOPAD_SMOKE_EVAL_PREF='<js>'  same for the preferences window
cd "$(dirname "$0")/.."
LOG=$(mktemp /tmp/haroopad-smoke.XXXXXX)
HAROOPAD_SMOKE=1 HAROOPAD_SMOKE_TIMEOUT=${HAROOPAD_SMOKE_TIMEOUT:-90000} env -u ELECTRON_RUN_AS_NODE \
  node_modules/electron/dist/electron . --no-sandbox "$@" > "$LOG" 2>&1 &
PID=$!
for i in $(seq 1 120); do
  sleep 1
  kill -0 $PID 2>/dev/null || break
done
kill -9 $PID 2>/dev/null
grep -v ":WARNING:\|Fontconfig\|^$\|deprecated\|Security Warning\|Policy set\|this app to\|For more information\|electronjs.org\|This warning\|once the app\|trace-deprecation" "$LOG" | cut -c1-2000
rm -f "$LOG"
