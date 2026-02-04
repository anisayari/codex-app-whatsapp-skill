import "dotenv/config";

import type { ReplyMode } from "./types";

export interface Config {
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  authStateDir: string;
  adminToken: string | null;
  replyMode: ReplyMode;
  webhookUrl: string | null;
  enableCli: boolean;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function parseLogLevel(
  value: string | undefined,
  fallback: Config["logLevel"]
): Config["logLevel"] {
  const normalized = (value || "").trim().toLowerCase();
  if (
    normalized === "fatal" ||
    normalized === "error" ||
    normalized === "warn" ||
    normalized === "info" ||
    normalized === "debug" ||
    normalized === "trace"
  ) {
    return normalized;
  }
  return fallback;
}

function parseReplyMode(value: string | undefined): ReplyMode {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "webhook" ? "webhook" : "echo";
}

export function loadConfig(): Config {
  return {
    port: parsePort(process.env.PORT, 8080),
    logLevel: parseLogLevel(process.env.LOG_LEVEL, "info"),
    authStateDir: process.env.AUTH_STATE_DIR || "./auth_state",
    adminToken: process.env.GATEWAY_ADMIN_TOKEN
      ? process.env.GATEWAY_ADMIN_TOKEN.trim()
      : null,
    replyMode: parseReplyMode(process.env.REPLY_MODE),
    webhookUrl: process.env.WEBHOOK_URL ? process.env.WEBHOOK_URL.trim() : null,
    enableCli: parseBoolean(process.env.ENABLE_CLI, true),
  };
}
