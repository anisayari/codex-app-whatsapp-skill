# CLI Commands Reference

Use this reference when implementing an OpenClaw-style CLI for the gateway.

## Commands

### /init
Start onboarding, capture consent, then show QR.

### /update
Pull the latest skill version from the GitHub repository.

Behavior:
- Run `git pull --ff-only` inside the skill folder.
- If there are local changes, warn the user and require confirmation before pulling.

Example flow:
- User runs `/update`
- CLI checks `git status --porcelain`
- If clean: run pull and report the current commit
- If dirty: show warning and ask for confirmation

### /status
Show connection and session details.

Minimum fields:
- `connection`: connected | connecting | disconnected
- `active`: yes | no
- `jid`: WhatsApp JID (if connected)
- `number`: human-readable phone number (if available)
- `last_message_at`: ISO timestamp (if available)

Notes:
- If the client is not connected, show `active: no` and omit `jid/number`.
- If multiple sessions are supported, list all active JIDs.
