# Web UI Mirror (Optional)

Use this reference when the user wants a "chat here" mirror of WhatsApp.

## Constraints
- The Codex UI itself cannot be wired to WhatsApp.
- Build a separate web UI that talks to the gateway API.

## Minimal API Surface
- `GET /conversations` returns active jids with last message time.
- `GET /messages?jid=...` returns recent messages.
- `POST /send` sends a message to a jid.

## UI Notes
- Keep the UI read and send only.
- Avoid storing media unless required.
- Show connection status and last QR scan time.
