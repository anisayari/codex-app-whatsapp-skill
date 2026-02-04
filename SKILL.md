---
name: whatsapp-bridge
description: Build and operate a non-official WhatsApp Web gateway using Baileys to bridge WhatsApp chats with an AI or internal systems, in a separate server, without Meta/Twilio. Use when asked for an OpenClaw-style gateway, a WhatsApp relay, a bidirectional WhatsApp bot, or a "connect Codex chat to WhatsApp" request that must avoid the Business Platform.
---

# WhatsApp Bridge

## Overview
Build a separate WhatsApp Web gateway (Baileys) that receives and sends WhatsApp messages and optionally forwards them to an AI service. Use this when the user explicitly wants a non-WhatsApp-Business integration and accepts the reliability and ban risk.

## Workflow Decision Tree
- If the user refuses Meta/Twilio, proceed with Baileys and confirm they accept account risk.
- If the user wants "the Codex chat" mirrored, explain that the Codex UI cannot be wired directly and propose a small web UI mirror instead.
- If the user needs outbound-only updates, implement only the send path and skip inbound processing.
- If the user needs two-way chat, implement the full inbound and outbound pipeline with persistence.
- If the user asks for a separate server, keep the gateway in its own repository or service and expose only an HTTP API to other systems.

## Core Build Steps
1. Confirm requirements: one-way or two-way, target numbers or groups, storage expectations, and hosting target.
2. Set up a separate Node service and persist Baileys auth state on disk.
3. Implement inbound handling with dedupe, ignore bot messages, and basic rate limiting.
4. Implement outbound sending with simple retry logic and message queueing.
5. Add an LLM handler with per-JID state and message summarization.
6. Add health checks, logs, and a QR re-auth flow.

## Quick Start (Template)
- Use `scripts/init_gateway.sh --path <output-dir>` to generate a ready-to-run gateway project from `assets/gateway-template`.
- Deploy the generated gateway folder to a separate server, then run `/init` to authenticate.

Reference: `references/quickstart.md`.

## Skill Auto-Update (Local)
- On skill start (or whenever the user asks), do a best-effort update check against GitHub.
- If the user asks to “update the skill”, or types `update` / `/update`, run `scripts/update_skill.sh` to pull the latest version from GitHub.
- If there are local changes, show them and ask whether to retry with `--force`.
- After updating, re-open `SKILL.md` (instructions may have changed).

Reference: `references/cli-commands.md`.

## OpenClaw-Style Onboarding (/init)
- ▶️ Provide a `/init` command that starts the onboarding flow.
- ⚠️ Show a clear risk notice and require explicit user consent (yes/no) before starting WhatsApp.
- ✅ Only generate and display the QR code after consent is accepted.
- 🧭 Keep the flow stateful (`awaiting_consent`, `awaiting_qr_scan`, `connected`).
- ❌ If the user declines, exit cleanly and do not start Baileys.

Reference: `references/init-onboarding.md`.


## CLI Commands (/update, /status)
- Provide `/status` to display connection state, activation, and current number (gateway runtime).
- Optionally provide `/update` in the gateway runtime to update the gateway code via `git pull --ff-only`.
- Keep outputs short and readable for terminal use.

Reference: `references/cli-commands.md`.


## Message Pipeline Rules
- Always ignore messages sent by the bot itself.
- Deduplicate by message id and jid to avoid loops.
- Normalize jids before storage and routing.
- Limit outbound frequency per jid to avoid spam and bans.

## Storage Guidance
- Persist Baileys auth state on disk so the session survives restarts.
- Store conversation state by jid in a durable store if you need continuity.
- Keep a rolling summary to cap token usage.

## Safety And Compliance
- Require explicit opt-in and implement STOP or human escalation.
- Avoid storing media unless required; prefer text only.
- Do not hardcode secrets; load from environment variables.

## References
- `references/baileys-gateway.md` for Baileys setup, auth state, and message events.
- `references/openai-bridge.md` for the LLM call wrapper and conversation state pattern.
- `references/ops-runbook.md` for deployment, restarts, and QR recovery.
- `references/web-ui-bridge.md` for the optional web UI mirror.
- `references/init-onboarding.md` for the `/init` onboarding flow and QR display.
- `references/cli-commands.md` for `/update` and `/status` commands.
- `references/quickstart.md` for the simplest end-to-end setup.
