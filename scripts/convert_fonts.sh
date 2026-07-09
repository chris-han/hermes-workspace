#!/usr/bin/env bash
set -euo pipefail

# Convert PlusJakartaDisplay OTFs to WOFF2 and name them PlusJakartaSans-*.woff2
cd "$(dirname "$0")/.."
python3 -m pip install --upgrade --user fonttools brotli || true

FONT_DIR=public/font
if [ ! -d "$FONT_DIR" ]; then
  echo "Font directory $FONT_DIR not found" >&2
  exit 1
fi

for f in "$FONT_DIR"/PlusJakartaDisplay-*.otf; do
  [ -e "$f" ] || continue
  base=$(basename "$f" .otf)
  case "$base" in
    PlusJakartaDisplay-Regular) out=PlusJakartaSans-Regular.woff2;;
    PlusJakartaDisplay-Medium) out=PlusJakartaSans-Medium.woff2;;
    PlusJakartaDisplay-Light) out=PlusJakartaSans-Light.woff2;;
    *) out="$base.woff2";;
  esac
  echo "Converting $f -> $FONT_DIR/$out"
  python3 -m fontTools.subset "$f" --output-file="$FONT_DIR/$out" --flavor=woff2 --layout-features='*' --no-hinting
done

echo "Font conversion complete."
