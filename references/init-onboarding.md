# /init Onboarding Flow

Use this reference when the user wants an OpenClaw-style onboarding that starts with a `/init` command and guides the user through risks and QR setup.

## Goals
- Provide an explicit consent step (Yes/No) before any WhatsApp session is created.
- Present the QR code only after consent is captured.
- Avoid silent behavior; show clear status messages in each step.

## Suggested /init State Machine
1. `idle`
2. `awaiting_consent`
3. `awaiting_qr_scan`
4. `connected`
5. `failed`

## CLI Behavior (Example)
- User runs `/init`
- CLI shows risk notice and asks for confirmation
- If user confirms, start Baileys and show QR
- If user declines, exit with a clear message

## Example Copy (Risk Notice)
"This gateway uses WhatsApp Web (non-official). It can be unstable and may lead to account restrictions. Use a dedicated number. Do you accept this risk? (yes/no)"

## QR Display Guidance
- Print the QR in the terminal using a QR library.
- Also keep a raw QR string in logs for fallback.

## Minimal Pseudocode
```ts
// /init handler
if (state !== 'idle') return;
printRiskNotice();
state = 'awaiting_consent';

// on user input
if (state === 'awaiting_consent') {
  if (input === 'yes') {
    startWhatsApp();
    state = 'awaiting_qr_scan';
  } else {
    print('Setup cancelled.');
    state = 'idle';
  }
}

// on Baileys QR
if (state === 'awaiting_qr_scan') {
  renderQr(qr);
}

// on connected
state = 'connected';
print('Connected.');
```

## API Variant
If you build an HTTP API instead of a CLI, expose:
- `POST /init` → returns "awaiting_consent"
- `POST /init/confirm` with `{"accept": true}` → starts Baileys
- `GET /init/qr` → returns current QR text or PNG
- `GET /status` → returns connection state
