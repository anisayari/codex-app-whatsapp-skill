#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --url <http://host:port> [--token <admin-token>]" >&2
  exit 1
}

URL=""
TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      URL="${2:-}"
      shift 2
      ;;
    --token)
      TOKEN="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

[[ -n "$URL" ]] || usage

echo "⚠️  This gateway uses WhatsApp Web (non-official). It can be unstable and may lead to account restrictions." >&2
echo "📱 Use a dedicated number." >&2

read -r -p "Do you accept this risk? (yes/no) " ANSWER
ANSWER="$(echo "$ANSWER" | tr '[:upper:]' '[:lower:]' | xargs)"

if [[ "$ANSWER" != "yes" && "$ANSWER" != "y" ]]; then
  echo "❌ Cancelled." >&2
  exit 0
fi

AUTH_ARGS=()
if [[ -n "$TOKEN" ]]; then
  AUTH_ARGS+=( -H "Authorization: Bearer $TOKEN" )
fi

echo "✅ Starting WhatsApp session..." >&2
curl -fsS "${AUTH_ARGS[@]}" -H "content-type: application/json" -X POST \
  "$URL/init" \
  -d '{"acceptRisk":true}' >/dev/null

echo "⏳ Waiting for QR..." >&2

for _ in $(seq 1 40); do
  if QR_JSON=$(curl -fsS "${AUTH_ARGS[@]}" "$URL/qr" 2>/dev/null); then
    if command -v python3 >/dev/null 2>&1; then
      echo "$QR_JSON" | python3 - <<'PY'
import json
import sys

data = json.load(sys.stdin)
ascii_qr = data.get('ascii')
raw = data.get('raw')
if isinstance(ascii_qr, str) and ascii_qr.strip():
    print(ascii_qr)
elif isinstance(raw, str) and raw.strip():
    print(raw)
else:
    print("(QR not available)")
PY
    else
      echo "$QR_JSON"
    fi
    echo "\n✅ QR ready. Scan it with WhatsApp." >&2
    exit 0
  fi
  sleep 1
  echo -n "." >&2

done

echo "\n❌ Timed out waiting for QR. Check gateway logs or try again." >&2
exit 1
