#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
SKILL_DIR="$CODEX_HOME_DIR/skills/whatsapp-bridge"

if [[ ! -d "$SKILL_DIR" ]]; then
  echo "[ERROR] Skill not found at: $SKILL_DIR" >&2
  echo "Install with:" >&2
  echo "  git clone https://github.com/anisayari/codex-app-whatsapp-skill \"$SKILL_DIR\"" >&2
  exit 1
fi

if [[ ! -d "$SKILL_DIR/.git" ]]; then
  echo "[ERROR] Skill directory is not a git checkout: $SKILL_DIR" >&2
  echo "If you installed it by copying files, reinstall via git clone." >&2
  exit 1
fi

dirty="$(git -C "$SKILL_DIR" status --porcelain)"
if [[ -n "$dirty" && "${1:-}" != "--force" ]]; then
  echo "[ERROR] Local changes detected in $SKILL_DIR. Aborting update." >&2
  echo "Run again with --force if you understand the risk." >&2
  echo >&2
  echo "$dirty" >&2
  exit 2
fi

before="$(git -C "$SKILL_DIR" rev-parse --short HEAD 2>/dev/null || true)"

git -C "$SKILL_DIR" pull --ff-only

after="$(git -C "$SKILL_DIR" rev-parse --short HEAD 2>/dev/null || true)"

if [[ -n "$before" && "$before" == "$after" ]]; then
  echo "[OK] Skill already up to date ($after)."
else
  echo "[OK] Skill updated: ${before:-unknown} -> ${after:-unknown}"
fi
