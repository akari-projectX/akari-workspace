#!/usr/bin/env bash
# Clone the three Akari repos as siblings next to this workspace checkout
# (smoke.sh and sync-proto rely on the ../akari-* sibling layout).
set -euo pipefail
cd "$(dirname "$0")"
ORG=${ORG:-git@github.com:akari-projectX}
for r in akari-panel akari-agent akari-client; do
  if [ -d "$r/.git" ]; then
    echo "skip $r (exists)"
  else
    git clone "$ORG/$r.git" "$r"
  fi
done
