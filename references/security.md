# Security Hardening Checklist

This project is powerful by design: it bridges WhatsApp messages to automation on your machine.
Treat it like remote admin access.

## Must-Do Defaults

- Use a **dedicated WhatsApp number**.
- Keep `REPLY_MODE=codex` on **read-only** until you are comfortable:
  - `CODEX_SANDBOX=read-only` (default)
- Do not respond to unknown senders:
  - Use owner pairing (`PAIR <code>`) or set `OWNER_NUMBERS` / `OWNER_JIDS`.

## HTTP Exposure

- Prefer `HOST=127.0.0.1`.
- If you must expose HTTP:
  - Set `GATEWAY_ADMIN_TOKEN`.
  - Put it behind a reverse proxy with TLS.
  - Firewall the port to your IPs only.

## Operational Safety

- Avoid logging message bodies.
- Keep auth state (`AUTH_STATE_DIR`) on a durable disk and back it up.
- Add rate limiting and monitor for unusual inbound volume.

## If You Enable Writes

If you set `CODEX_SANDBOX=workspace-write` (or worse):

- Restrict `CODEX_WORKDIR` to a single repo directory.
- Consider a second factor (PIN/allowlist).
- Keep the machine user account locked down.
