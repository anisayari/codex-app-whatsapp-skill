# WhatsApp Bridge Codex Skill

A Codex skill for building a **non-official WhatsApp Web gateway** (Baileys) that bridges WhatsApp chats with an AI or internal systems, on a **separate server**, without using the WhatsApp Business Platform (Meta/Twilio).

This mirrors an “OpenClaw-style” gateway: a lightweight WhatsApp relay that you can control and host yourself.

## What This Skill Covers

- Baileys gateway setup with QR auth and reconnection
- Inbound/outbound message flow (two-way chat)
- Dedupe, rate limiting, and loop prevention
- Conversation state + rolling summaries for LLMs
- Ops runbook (health checks, restarts, QR recovery)
- Optional web UI mirror (separate from Codex UI)

## Important Risk Note

This approach uses **WhatsApp Web** (non-official). It is more fragile and can be subject to account limits/bans if WhatsApp changes policies or detects automation. Use a **dedicated number** and accept the risk.

## Install in Codex

This repository is a single skill folder. To install it in the Codex app, clone it into your Codex skills directory:

```bash
git clone https://github.com/anisayari/codex-app-whatsapp-skill ~/.codex/skills/whatsapp-bridge
```

If you are using a custom Codex home, replace `~/.codex` with your `CODEX_HOME` path.

### Update

```bash
cd ~/.codex/skills/whatsapp-bridge
git pull
```

### Uninstall

```bash
rm -rf ~/.codex/skills/whatsapp-bridge
```

## Skill Files

- `SKILL.md` — main instructions and workflow
- `references/baileys-gateway.md` — Baileys setup + message event patterns
- `references/openai-bridge.md` — LLM bridge + conversation state guidance
- `references/ops-runbook.md` — deployment, restarts, health checks
- `references/web-ui-bridge.md` — optional web UI mirror

## Usage Examples (Triggers)

- “Build a WhatsApp gateway without Meta/Twilio”
- “Connect WhatsApp to my AI with Baileys”
- “OpenClaw-style WhatsApp relay”
- “Mirror WhatsApp messages to a web UI”

## What It Does *Not* Do

- It does not directly wire the Codex UI to WhatsApp.
- It does not provide official WhatsApp Business compliance.
- It does not include a full production gateway implementation—this skill guides you to build one.

## Support

If you want me to implement the actual gateway server and deploy it, tell me:

- TypeScript or JavaScript
- Hosting target (VM, Docker, etc.)
- Storage choice (memory, SQLite, Postgres)
