# Baileys Gateway Reference

Use this reference when building the non-official WhatsApp Web gateway with Baileys.

## Preconditions
- Use a dedicated phone number.
- Keep the gateway on a separate server or repo.
- Persist auth state on disk and back it up.

## Minimal File Tree
```
whatsapp-gateway/
  src/
    index.ts
    wa.ts
    store.ts
    types.ts
  .env
  package.json
  tsconfig.json
```

## Environment Variables
```
PORT=8080
AUTH_STATE_DIR=./auth_state
SYSTEM_PROMPT=You are a helpful assistant.
OPENAI_API_KEY=replace-me
OPENAI_MODEL=replace-me
```

## Minimal Types
```ts
// src/types.ts
export interface InboundMessage {
  jid: string;
  messageId: string;
  text: string;
  timestampMs: number;
}

export interface OutboundSender {
  sendText: (jid: string, text: string) => Promise<void>;
}
```

## Baileys Client Skeleton
```ts
// src/wa.ts
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import pino from "pino";
import type { InboundMessage, OutboundSender } from "./types.js";

export interface WhatsAppClientOptions {
  authStateDir: string;
  onInbound: (msg: InboundMessage) => Promise<void>;
}

export async function startWhatsApp(
  options: WhatsAppClientOptions
): Promise<OutboundSender> {
  const logger = pino({ level: "info" });
  const { state, saveCreds } = await useMultiFileAuthState(options.authStateDir);

  const socket = makeWASocket({
    auth: state,
    logger,
    markOnlineOnConnect: false,
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    if (update.qr) {
      logger.info("QR received. Scan to authenticate.");
    }
    if (update.connection === "close") {
      const shouldReconnect =
        (update.lastDisconnect?.error as { output?: { statusCode?: number } })
          ?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startWhatsApp(options).catch((err) => logger.error({ err }));
      }
    }
  });

  socket.ev.on("messages.upsert", async (event) => {
    if (event.type !== "notify") return;
    for (const message of event.messages) {
      if (!message.message) continue;
      if (message.key.fromMe) continue;
      const jid = jidNormalizedUser(message.key.remoteJid || "");
      if (!jid) continue;

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";
      if (!text.trim()) continue;

      await options.onInbound({
        jid,
        messageId: message.key.id || "",
        text,
        timestampMs: (message.messageTimestamp || 0) * 1000,
      });
    }
  });

  return {
    sendText: async (jid: string, text: string) => {
      await socket.sendMessage(jid, { text });
    },
  };
}
```

## Orchestrator Example
```ts
// src/index.ts
import "dotenv/config";
import { startWhatsApp } from "./wa.js";
import { createStore } from "./store.js";
import type { InboundMessage } from "./types.js";

async function main(): Promise<void> {
  const store = createStore();

  const outbound = await startWhatsApp({
    authStateDir: process.env.AUTH_STATE_DIR || "./auth_state",
    onInbound: async (msg: InboundMessage) => {
      const reply = await store.handleInbound(msg);
      if (reply) {
        await outbound.sendText(msg.jid, reply);
      }
    },
  });
}

void main();
```

## Store Stub
```ts
// src/store.ts
import type { InboundMessage } from "./types.js";

export interface Store {
  handleInbound: (msg: InboundMessage) => Promise<string | null>;
}

export function createStore(): Store {
  return {
    handleInbound: async (msg: InboundMessage) => {
      if (!msg.text.trim()) return null;
      return "Ack: " + msg.text;
    },
  };
}
```

## Notes
- Prefer in-memory dedupe with a short TTL keyed by jid and messageId.
- Add rate limiting per jid before sending replies.
- Avoid media handling in the first iteration.
