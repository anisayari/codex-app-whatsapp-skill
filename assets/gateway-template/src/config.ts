import "dotenv/config";

import type { ReplyMode } from "./types";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export interface Config {
  host: string;
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  authStateDir: string;
  adminToken: string | null;
  ownerNumbersFromEnv: string[];
  ownerJidsFromEnv: string[];
  allowGroups: boolean;
  replyMode: ReplyMode;
  webhookUrl: string | null;
  maxInboundChars: number;
  maxReplyChars: number;
  codex: {
    bin: string;
    workdir: string;
    sandbox: CodexSandboxMode;
    model: string | null;
    timeoutMs: number;
    skipGitRepoCheck: boolean;
  };
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

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
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
  if (normalized === "webhook") return "webhook";
  if (normalized === "codex") return "codex";
  return "echo";
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseCodexSandbox(value: string | undefined): CodexSandboxMode {
  const normalized = (value || "").trim().toLowerCase();
  if (
    normalized === "read-only" ||
    normalized === "workspace-write" ||
    normalized === "danger-full-access"
  ) {
    return normalized;
  }
  return "read-only";
}

export function loadConfig(): Config {
  return {
    host: (process.env.HOST || "127.0.0.1").trim() || "127.0.0.1",
    port: parsePort(process.env.PORT, 8080),
    logLevel: parseLogLevel(process.env.LOG_LEVEL, "info"),
    authStateDir: process.env.AUTH_STATE_DIR || "./auth_state",
    adminToken: process.env.GATEWAY_ADMIN_TOKEN
      ? process.env.GATEWAY_ADMIN_TOKEN.trim()
      : null,
    ownerNumbersFromEnv: parseCsv(process.env.OWNER_NUMBERS),
    ownerJidsFromEnv: parseCsv(process.env.OWNER_JIDS),
    allowGroups: parseBoolean(process.env.ALLOW_GROUPS, false),
    replyMode: parseReplyMode(process.env.REPLY_MODE),
    webhookUrl: process.env.WEBHOOK_URL ? process.env.WEBHOOK_URL.trim() : null,
    maxInboundChars: parsePositiveInt(process.env.MAX_INBOUND_CHARS, 4000),
    maxReplyChars: parsePositiveInt(process.env.MAX_REPLY_CHARS, 3500),
    codex: {
      bin: (process.env.CODEX_BIN || "codex").trim() || "codex",
      workdir: (process.env.CODEX_WORKDIR || ".").trim() || ".",
      sandbox: parseCodexSandbox(process.env.CODEX_SANDBOX),
      model: process.env.CODEX_MODEL ? process.env.CODEX_MODEL.trim() : null,
      timeoutMs: parsePositiveInt(process.env.CODEX_TIMEOUT_MS, 5 * 60_000),
      skipGitRepoCheck: parseBoolean(process.env.CODEX_SKIP_GIT_CHECK, true),
    },
    enableCli: parseBoolean(process.env.ENABLE_CLI, true),
  };
}
