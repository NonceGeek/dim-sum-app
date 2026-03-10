#!/usr/bin/env bash
set -euo pipefail

SRC="${1:-.}"
DEST="${2:-./flattened}"

mkdir -p "$DEST"

# Move every file under SRC (recursively) into DEST.
# If a filename collision happens, it appends _1, _2, ...
find "$SRC" -type f -print0 | while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  target="$DEST/$base"

  if [[ ! -e "$target" ]]; then
    mv "$f" "$target"
  else
    name="${base%.*}"
    ext=""
    [[ "$base" == *.* ]] && ext=".${base##*.}"

    i=1
    while [[ -e "$DEST/${name}_$i$ext" ]]; do
      i=$((i+1))
    done
    mv "$f" "$DEST/${name}_$i$ext"
  fi
done
