# WhatsApp Web Gateway (Baileys)

Non-official WhatsApp Web gateway with:

- ✅ `/init` onboarding (explicit risk consent + QR)
- 🔐 owner pairing (send: `PAIR <code>` from your phone)
- 📟 `/status` command + `GET /status`
- 🔁 `/update` (git pull) if this folder is a git repo
- 🤖 `REPLY_MODE=codex` to talk to your local Codex CLI
- 🌐 HTTP endpoints for basic ops (`/health`, `/status`, `/qr`, `/init`, `/send`)

## Risk

This is a **non-official** integration (WhatsApp Web). It can break or lead to account restrictions/bans.
Use a dedicated number.

## Quick Start (Node)

```bash
cp .env.example .env
npm install
npm run dev
```

Then in the CLI:

1. Run `/init`
2. Type `yes`
3. Scan the QR
4. Pair your phone (one-time): send `PAIR <code>` to the gateway number
5. Run `/status`

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Auth state is persisted in `./auth_state` (volume mounted).

## HTTP API

If `GATEWAY_ADMIN_TOKEN` is set, call admin endpoints with:

```
Authorization: Bearer <token>
```

Endpoints:

- `GET /health` (no auth)
- `GET /status`
- `GET /qr`
- `POST /init` body: `{ "acceptRisk": true }`
- `POST /send` body: `{ "jid": "<jid>", "text": "<message>" }`

## Notes

- You must run `/init` (or `POST /init`) before the gateway starts a WhatsApp session.
- If the session gets logged out, you will need to re-run `/init` and scan a new QR.
- For security, the gateway ignores all WhatsApp messages until it is paired (or `OWNER_*` env vars are set).
- If you bind `HOST` to a non-local address, you must set `GATEWAY_ADMIN_TOKEN`.
