#!/bin/sh
# Quantise screenshots to a 256-colour palette (ImageMagick) to stay under the size budget.
set -eu
cd "$(dirname "$0")/../screenshots"
for f in *.png; do
  convert "$f" -strip -dither None -colors 256 -define png:compression-level=9 "PNG8:$f"
done
du -sh .
