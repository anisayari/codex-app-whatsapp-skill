import type { Config } from "./config";
import type { InboundMessage, ReplyMode } from "./types";
import { createCodexReplier } from "./codex-replier";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readReplyField(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const reply = value["reply"];
  return typeof reply === "string" ? reply : null;
}

async function webhookReply(config: Config, msg: InboundMessage): Promise<string> {
  if (!config.webhookUrl) {
    throw new Error("REPLY_MODE=webhook requires WEBHOOK_URL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(msg),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Webhook error: ${res.status} ${res.statusText} ${body}`.trim());
    }

    const json = (await res.json()) as unknown;
    const reply = readReplyField(json);
    if (!reply) {
      throw new Error("Webhook response must be JSON: { reply: string }");
    }

    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

function echoReply(msg: InboundMessage): string {
  return `✅ Received: ${msg.text}`;
}

export function createReplier(config: Config): (msg: InboundMessage) => Promise<string> {
  const mode: ReplyMode = config.replyMode;

  if (mode === "webhook") {
    return async (msg) => webhookReply(config, msg);
  }

  if (mode === "codex") {
    return createCodexReplier(config);
  }

  return async (msg) => echoReply(msg);
}
