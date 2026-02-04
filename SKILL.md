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
