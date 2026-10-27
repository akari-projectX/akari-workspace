#!/bin/bash
# prints "path|device|summary"
cd /home/lam/projectX/akari-workspace/.work/portal-restore/harness
for p in "$@"; do for d in desktop mobile; do
  r=$(node geo.mjs "${p%%|*}" --device=$d ${p#*|} 2>&1 | grep -E '^diffs' )
  echo "$p|$d|$r"
done; done
