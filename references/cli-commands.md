# Commands Reference (/update, /status, /init)

Use this reference when the user wants an OpenClaw-style onboarding experience with simple commands.

This repo has **two contexts**:

1. **Codex skill (local)**: update the skill itself.
2. **Gateway runtime (server)**: start WhatsApp and check connection.

## Codex Skill Commands (Local)

### update or /update
Goal: update the *skill* to the latest version from GitHub.

Recommended behavior:
- Run `scripts/update_skill.sh`.
- If there are local changes, show them and ask whether to retry with `--force`.
- If the update succeeds, re-open `SKILL.md` (instructions may have changed).

## Gateway Commands (Server)

### /init
Goal: start onboarding, capture consent, then show the QR.

Recommended behavior:
- Show a clear risk notice and ask for explicit consent (yes/no).
- Only start Baileys and display the QR after consent is accepted.
- If the user declines, exit cleanly and do not start WhatsApp.

### /status
Goal: show whether the gateway is connected and which number is active.

Minimum fields:
- `connection`: connected | connecting | disconnected
- `active`: yes | no
- `jid`: WhatsApp JID (if connected)
- `number`: human-readable phone number (if available)
- `last_message_at`: ISO timestamp (if available)

### /update
Goal: update the *gateway* code (optional).

Recommended behavior:
- If the gateway folder is a git repo, run `git pull --ff-only`.
- If dirty, warn and require confirmation.
- After update, tell the user to restart the process.
