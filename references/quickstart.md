# Quick Start (User-Friendly)

Use this reference when the user wants the simplest path to a working gateway.

## 1) Update The Skill (optional but recommended)

If the skill was installed via git clone:

- Run `scripts/update_skill.sh` (best effort).
- If the working tree is dirty, warn the user and ask whether to proceed with `--force`.

## 2) Generate A Gateway Project

Use the bundled template:

- Run `scripts/init_gateway.sh --path <output-dir>`
- The output directory becomes the gateway project.

## 3) Deploy To A Separate Server

Recommended options:

- Copy the generated gateway folder to the server (rsync/scp)
- Or commit it to a dedicated gateway repo and deploy from git

## 4) Run And Onboard

On the server:

- `cp .env.example .env`
- Set `GATEWAY_ADMIN_TOKEN` (recommended)
- `npm install`
- `npm run dev`
- In the CLI, run `/init` → accept risk → scan QR
- Run `/status`

## 5) Verify /status From Outside (optional)

If HTTP is exposed:

- `GET /health`
- `GET /status` with `Authorization: Bearer <token>`
- Or use the helper scripts:

```bash
scripts/gateway_init.sh --url http://server:8080 --token <token>
scripts/gateway_status.sh --url http://server:8080 --token <token>
```

## 6) Common Failure Modes

- Logged out: rerun `/init` and rescan QR.
- No QR shown: check logs, or call `GET /qr`.
- Webhook mode failing: verify `WEBHOOK_URL` and return `{ reply: string }`.
