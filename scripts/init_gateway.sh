#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --path <output-dir>" >&2
  exit 1
}

OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

[[ -n "$OUTPUT_DIR" ]] || usage

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/assets/gateway-template"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "[ERROR] Template directory not found: $TEMPLATE_DIR" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

if [[ -n "$(ls -A "$OUTPUT_DIR" 2>/dev/null || true)" ]]; then
  echo "[ERROR] Output directory is not empty: $OUTPUT_DIR" >&2
  exit 2
fi

cp -R "$TEMPLATE_DIR/." "$OUTPUT_DIR/"

cat <<MSG
[OK] Gateway template created at: $OUTPUT_DIR

Next steps:
  cd "$OUTPUT_DIR"
  cp .env.example .env
  npm install
  npm run dev

Then type /init in the CLI and scan the QR.
MSG
