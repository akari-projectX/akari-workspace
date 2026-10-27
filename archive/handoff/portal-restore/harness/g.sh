#!/bin/bash
# g.sh "<path> [opts]"...  -> prints first 12 lines of geo diff for each
cd /home/lam/projectX/akari-workspace/.work/portal-restore/harness
for a in "$@"; do echo "== $a"; node geo.mjs $a 2>&1 | head -${N:-12}; done
