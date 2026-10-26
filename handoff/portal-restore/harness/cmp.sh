#!/bin/bash
# cmp.sh <group-dir> <name> <path> [shot opts]  -> design/portal-restore-2026-10/<group>/compare/<name>-<device>-<theme>.png
G=$1; N=$2; P=$3; shift 3
D=/home/lam/projectX/akari-workspace/design/portal-restore-2026-10/$G/compare; mkdir -p $D
cd /home/lam/projectX/akari-workspace/.work/portal-restore/harness
node shot.mjs $N $P "$@" >/dev/null 2>&1
for d in desktop mobile; do for t in light dark; do [ -f out/$N-cmp-$d-$t.png ] && cp out/$N-cmp-$d-$t.png $D/$N-$d-$t.png; done; done
