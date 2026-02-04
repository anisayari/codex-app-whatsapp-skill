import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { Config } from "./config";
import type { InboundMessage } from "./types";

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 20)).trimEnd() + "\n…(truncated)";
}

function buildPrompt(userText: string): string {
  return [
    "You are Codex responding over WhatsApp.",
    "Be concise, direct, and practical.",
    "Avoid long preambles. Prefer short paragraphs and short lists.",
    "If you output code, keep it minimal.",
    "",
    "User message:",
    userText,
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
    const prompt = buildPrompt(msg.text);
    const result = await runCodexOnce({ config, prompt });
    if (!result.ok) {
      return truncateText(`❌ ${result.error}`, config.maxReplyChars);
    }

    return truncateText(result.text, config.maxReplyChars);
  };
}
