import express, { type Request, type Response } from "express";

import type { Config } from "./config";
import type { InboundMessage } from "./types";
import { StatusStore } from "./status-store";
import { WhatsAppGateway } from "./whatsapp-gateway";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function requireAuth(config: Config) {
  return (req: Request, res: Response, next: () => void) => {
    if (!config.adminToken) return next();

    const header = req.header("authorization") || "";
    const expected = `Bearer ${config.adminToken}`;
    if (header !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

function rateLimit(params: { windowMs: number; max: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: () => void) => {
    const now = Date.now();
    const ip = req.ip || "unknown";

    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + params.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > params.max) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    next();
  };
}

export function startHttpServer(params: {
  config: Config;
  status: StatusStore;
  gateway: WhatsAppGateway;
  startedAt: Date;
}): void {
  const { config, status, gateway, startedAt } = params;

  if (!isLoopbackHost(config.host) && !config.adminToken) {
    throw new Error("Refusing to bind HTTP to a non-local host without GATEWAY_ADMIN_TOKEN.");
  }

  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      state: status.getSnapshot().state,
      uptime_ms: Date.now() - startedAt.getTime(),
    });
  });

  app.use(rateLimit({ windowMs: 60_000, max: 120 }));

  app.use(express.json({ limit: "256kb" }));

  app.get("/status", requireAuth(config), (_req, res) => {
    res.json(status.toPublicStatus());
  });

  app.get("/qr", requireAuth(config), (_req, res) => {
    const qr = gateway.getQr();
    if (!qr) {
      res.status(404).json({ error: "No QR available" });
      return;
    }
    res.json(qr);
  });

  app.post("/init", requireAuth(config), async (req, res) => {
    const body: unknown = req.body;
    const acceptRisk = isRecord(body) ? readBoolean(body["acceptRisk"]) : null;

    if (acceptRisk !== true) {
      res.status(400).json({
        error: "Missing consent. Send JSON: { \"acceptRisk\": true }",
      });
      return;
    }

    try {
      await gateway.start();
      res.json({ ok: true });
    } catch (err) {
      status.setError(err);
      res.status(500).json({ error: "Failed to start WhatsApp" });
    }
  });

  app.post("/send", requireAuth(config), async (req, res) => {
    const body: unknown = req.body;
    if (!isRecord(body)) {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const jid = readString(body["jid"]);
    const text = readString(body["text"]);

    if (!jid || !text) {
      res.status(400).json({
        error: "Missing fields. Send JSON: { \"jid\": string, \"text\": string }",
      });
      return;
    }

    try {
      await gateway.sendText(jid, text);
      res.json({ ok: true });
    } catch (err) {
      status.setError(err);
      res.status(500).json({ error: "Failed to send" });
    }
  });

  app.post("/webhook-test", requireAuth(config), async (_req, res) => {
    const msg: InboundMessage = {
      jid: "0000000000@s.whatsapp.net",
      messageId: "test",
      text: "ping",
      timestampMs: Date.now(),
    };

    res.json({ ok: true, sample_message: msg });
  });

  app.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.log(`HTTP listening on ${config.host}:${config.port}`);
  });
}
