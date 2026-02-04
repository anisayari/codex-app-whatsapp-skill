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

AUTH_ARGS=()
if [[ -n "$TOKEN" ]]; then
  AUTH_ARGS+=( -H "Authorization: Bearer $TOKEN" )
fi

if command -v python3 >/dev/null 2>&1; then
  curl -fsS "${AUTH_ARGS[@]}" "$URL/status" | python3 -m json.tool
else
  curl -fsS "${AUTH_ARGS[@]}" "$URL/status"
fi
