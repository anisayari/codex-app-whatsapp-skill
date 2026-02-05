#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/3] Validate skill structure"
VALIDATOR="$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py"
if [[ -f "$VALIDATOR" ]]; then
  python3 "$VALIDATOR" "$ROOT_DIR"
else
  # Lightweight fallback (CI-friendly): verify SKILL.md has frontmatter with name + description.
  python3 - <<'PY'
from pathlib import Path
import re
skill_md = Path("SKILL.md")
if not skill_md.exists():
    raise SystemExit("[ERROR] SKILL.md not found")
content = skill_md.read_text(encoding="utf8")
match = re.match(r"^---\\n(.*?)\\n---\\n", content, re.DOTALL)
if not match:
    raise SystemExit("[ERROR] Invalid frontmatter (expected --- ... --- at top)")
front = match.group(1)
name = None
desc = None
for line in front.splitlines():
    if line.startswith("name:"):
        name = line.split(":", 1)[1].strip()
    if line.startswith("description:"):
        desc = line.split(":", 1)[1].strip()
if not name:
    raise SystemExit("[ERROR] Frontmatter missing name")
if not desc:
    raise SystemExit("[ERROR] Frontmatter missing description")
print("[OK] Frontmatter looks valid.")
PY
fi

echo "[2/3] Generate gateway template"
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t whatsapp-bridge-test)"
cleanup() {
  rm -rf "$TMP_DIR" || true
}
trap cleanup EXIT

"$ROOT_DIR/scripts/init_gateway.sh" --path "$TMP_DIR"

echo "[3/3] Build generated gateway"
cd "$TMP_DIR"
cp .env.example .env
npm install
npm run build

echo "[OK] All checks passed."
