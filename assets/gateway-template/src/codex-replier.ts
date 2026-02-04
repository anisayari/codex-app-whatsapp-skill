import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { Config } from "./config";
import type { InboundMessage } from "./types";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConversationFile {
  messages: StoredMessage[];
}

const MAX_HISTORY_LINES_CHARS = 8_000;
const MAX_HISTORY_MESSAGE_CHARS = 600;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 20)).trimEnd() + "\n…(truncated)";
}

function truncateForContext(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_HISTORY_MESSAGE_CHARS) return trimmed;
  return trimmed.slice(0, MAX_HISTORY_MESSAGE_CHARS - 20).trimEnd() + " …";
}

function hashJid(jid: string): string {
  return createHash("sha256").update(jid).digest("hex").slice(0, 16);
}

function isConversationFile(value: unknown): value is ConversationFile {
  if (typeof value !== "object" || value === null) return false;
  const maybe = value as { messages?: unknown };
  if (!Array.isArray(maybe.messages)) return false;
  for (const msg of maybe.messages) {
    if (typeof msg !== "object" || msg === null) return false;
    const m = msg as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (typeof m.content !== "string") return false;
  }
  return true;
}

async function loadConversation(params: {
  authStateDir: string;
  jid: string;
}): Promise<StoredMessage[]> {
  const dir = path.join(params.authStateDir, "conversations");
  const filePath = path.join(dir, `${hashJid(params.jid)}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw) as unknown;
    if (!isConversationFile(json)) return [];
    return json.messages.slice(-20);
  } catch {
    return [];
  }
}

async function saveConversation(params: {
  authStateDir: string;
  jid: string;
  messages: StoredMessage[];
}): Promise<void> {
  const dir = path.join(params.authStateDir, "conversations");
  const filePath = path.join(dir, `${hashJid(params.jid)}.json`);

  await fs.mkdir(dir, { recursive: true });
  const payload: ConversationFile = { messages: params.messages.slice(-40) };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function buildPrompt(params: { history: StoredMessage[]; userText: string }): string {
  const historyLines: string[] = [];
  if (params.history.length > 0) {
    const selected: StoredMessage[] = [];
    let totalChars = 0;

    // Accumulate from newest to oldest until we hit a character budget.
    for (let i = params.history.length - 1; i >= 0; i -= 1) {
      const msg = params.history[i];
      const content = truncateForContext(msg.content);
      const line = `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
      const nextTotal = totalChars + line.length + 1;
      if (nextTotal > MAX_HISTORY_LINES_CHARS) break;
      totalChars = nextTotal;
      selected.unshift({ role: msg.role, content });
    }

    historyLines.push("Conversation history (most recent last):");
    for (const msg of selected) {
      historyLines.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`);
    }
    historyLines.push("");
  }

  return [
    "You are Codex responding over WhatsApp.",
    "Be concise, direct, and practical.",
    "Avoid long preambles. Prefer short paragraphs and short lists.",
    "If you output code, keep it minimal.",
    "",
    ...historyLines,
    "User message:",
    params.userText,
  ].join("\n");
}

async function readLastMessage(outputFilePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(outputFilePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function runCodexOnce(params: {
  config: Config;
  prompt: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { config, prompt } = params;

  const outDir = path.join(config.authStateDir, "tmp");
  await fs.mkdir(outDir, { recursive: true });

  const outputFilePath = path.join(outDir, `codex_last_${Date.now()}.txt`);

  const args: string[] = [
    "exec",
    "--sandbox",
    config.codex.sandbox,
    "-C",
    config.codex.workdir,
    "--output-last-message",
    outputFilePath,
  ];

  if (config.codex.model) {
    args.push("-m", config.codex.model);
  }

  if (config.codex.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }

  // Read prompt from stdin to avoid argument escaping issues.
  args.push("-");

  const child = spawn(config.codex.bin, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  child.stdin.write(prompt);
  child.stdin.end();

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const exitCode: number | null = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(-1);
    }, config.codex.timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code ?? 0);
    });

    child.on("error", () => {
      clearTimeout(timeout);
      resolve(-2);
    });
  });

  const lastMessage = await readLastMessage(outputFilePath);
  const text = lastMessage || stdout.trim();

  if (exitCode === 0 && text) {
    return { ok: true, text };
  }

  const reason =
    exitCode === -1
      ? "Timed out"
      : exitCode === -2
        ? "Failed to start codex"
        : `Exit code ${exitCode}`;

  const err = ["Codex failed.", reason, stderr.trim()].filter(Boolean).join("\n");
  return { ok: false, error: err };
}

export function createCodexReplier(config: Config): (msg: InboundMessage) => Promise<string> {
  return async (msg: InboundMessage) => {
    const history = await loadConversation({ authStateDir: config.authStateDir, jid: msg.jid });
    const prompt = buildPrompt({ history, userText: msg.text });
    const result = await runCodexOnce({ config, prompt });
    if (!result.ok) {
      return truncateText(`❌ ${result.error}`, config.maxReplyChars);
    }

    const reply = truncateText(result.text, config.maxReplyChars);

    const nextMessages = history
      .concat([
        { role: "user", content: msg.text },
        { role: "assistant", content: reply },
      ])
      .slice(-40);
    await saveConversation({ authStateDir: config.authStateDir, jid: msg.jid, messages: nextMessages });

    return reply;
  };
}
