#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-/home/rida/projects/password-manager/}"
DST_DIR="${2:-/mnt/c/dev/password-manager/}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "Error: rsync is required but not installed."
  exit 1
fi

mkdir -p "$(dirname "$DST_DIR")"

rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude dist-electron \
  "$SRC_DIR" "$DST_DIR"

echo "Synced to $DST_DIR"
