# Ops Runbook

Use this reference for deployment, restarts, and QR recovery.

## Deployment Checklist
- Use a dedicated VM or container for the gateway.
- Persist the auth state directory on a durable volume.
- Store secrets in environment variables or a secret manager.

## Restart Strategy
- Run under a process manager or container restart policy.
- Reconnect on transient disconnects.
- Detect logged-out state and require a new QR scan.

## QR Recovery
- When QR is emitted, surface it in logs or a small admin page.
- Keep an admin-only endpoint that displays the current QR if needed.

## Health Endpoints
- Implement `GET /health` returning status, last message time, and connection state.
- Implement `POST /send` for internal systems to trigger outbound messages.

## Rate Limiting
- Throttle outbound messages per jid.
- Add a global backoff when WhatsApp returns errors.

## Data Safety
- Avoid logging message bodies in production.
- Clear old message history on a schedule.
