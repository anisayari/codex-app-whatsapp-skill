import readline from "node:readline";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

import { StatusStore } from "./status-store";
import { WhatsAppGateway } from "./whatsapp-gateway";

const execFile = promisify(execFileCb);

function formatStatusLine(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log("\nCommands:");
  // eslint-disable-next-line no-console
  console.log("  /init    Start onboarding (risk consent + QR)");
  // eslint-disable-next-line no-console
  console.log("  /status  Show connection status");
  // eslint-disable-next-line no-console
  console.log("  /update  git pull (if this folder is a git repo)");
  // eslint-disable-next-line no-console
  console.log("  /exit    Quit\n");

  // eslint-disable-next-line no-console
  console.log("Pairing:");
  // eslint-disable-next-line no-console
  console.log("  After /init, send: PAIR <code> from your phone to the gateway number.\n");
}

async function askYesNo(rl: readline.Interface, prompt: string): Promise<boolean> {
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve));
  const normalized = answer.trim().toLowerCase();
  return ["y", "yes"].includes(normalized);
}

async function runSelfUpdate(params: { rootDir: string; rl: readline.Interface }): Promise<void> {
  const { rootDir, rl } = params;

  try {
    const { stdout } = await execFile("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
    });
    if (!stdout.trim().toLowerCase().startsWith("true")) {
      // eslint-disable-next-line no-console
      console.log("❌ Not a git repository. /update skipped.");
      return;
    }
  } catch {
    // eslint-disable-next-line no-console
    console.log("❌ git not available or not a repository. /update skipped.");
    return;
  }

  let dirty = "";
  try {
    const res = await execFile("git", ["status", "--porcelain"], { cwd: rootDir });
    dirty = res.stdout.trim();
  } catch {
    // ignore
  }

  if (dirty) {
    // eslint-disable-next-line no-console
    console.log("⚠️  Local changes detected:");
    // eslint-disable-next-line no-console
    console.log(dirty);
    const ok = await askYesNo(rl, "Proceed with git pull --ff-only? (yes/no) ");
    if (!ok) {
      // eslint-disable-next-line no-console
      console.log("❌ Update cancelled.");
      return;
    }
  }

  const before = (await execFile("git", ["rev-parse", "--short", "HEAD"], { cwd: rootDir }))
    .stdout.trim();

  try {
    const pull = await execFile("git", ["pull", "--ff-only"], { cwd: rootDir });
    // eslint-disable-next-line no-console
    console.log(pull.stdout.trim() || pull.stderr.trim());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("❌ Update failed:", err instanceof Error ? err.message : String(err));
    return;
  }

  const after = (await execFile("git", ["rev-parse", "--short", "HEAD"], { cwd: rootDir }))
    .stdout.trim();

  if (before === after) {
    // eslint-disable-next-line no-console
    console.log(`✅ Already up to date (${after}).`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`✅ Updated: ${before} → ${after}`);
    // eslint-disable-next-line no-console
    console.log("ℹ️  Restart the process to load the new code.");
  }
}

function printStatus(status: StatusStore): void {
  const s = status.getSnapshot();

  const connection =
    s.state === "connected"
      ? "connected"
      : s.state === "starting" || s.state === "awaiting_qr_scan"
        ? "connecting"
        : "disconnected";

  // eslint-disable-next-line no-console
  console.log("\n📟 Status");
  // eslint-disable-next-line no-console
  console.log(formatStatusLine("connection:", connection));
  // eslint-disable-next-line no-console
  console.log(formatStatusLine("active:", s.active ? "yes" : "no"));
  // eslint-disable-next-line no-console
  console.log(formatStatusLine("paired:", s.paired ? "yes" : "no"));
  if (s.number) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("number:", s.number));
  }
  if (s.jid) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("jid:", s.jid));
  }
  if (s.pushName) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("push name:", s.pushName));
  }
  if (s.lastMessageAt) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("last message:", s.lastMessageAt));
  }
  if (s.lastQrAt) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("last qr:", s.lastQrAt));
  }
  if (s.lastError) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("last error:", s.lastError));
  }
  if (s.ownerJids.length > 0) {
    // eslint-disable-next-line no-console
    console.log(formatStatusLine("owner jids:", s.ownerJids.join(", ")));
  }
  // eslint-disable-next-line no-console
  console.log("");
}

export function startCli(params: {
  rootDir: string;
  gateway: WhatsAppGateway;
  status: StatusStore;
}): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // eslint-disable-next-line no-console
  console.log("\n🟢 WhatsApp Gateway CLI");
  // eslint-disable-next-line no-console
  console.log("Type /help for commands.\n");

  let busy = false;

  const handleLine = async (raw: string): Promise<void> => {
    if (busy) {
      // eslint-disable-next-line no-console
      console.log("⏳ Busy. Please wait...");
      return;
    }

    const line = raw.trim();
    if (!line) return;

    const cmd = line.toLowerCase();

    if (cmd === "/help" || cmd === "help") {
      printHelp();
      return;
    }

    if (cmd === "/exit" || cmd === "/quit" || cmd === "exit" || cmd === "quit") {
      rl.close();
      return;
    }

    if (cmd === "/status" || cmd === "status") {
      printStatus(params.status);
      return;
    }

    if (cmd === "/init" || cmd === "init") {
      busy = true;
      try {
        // eslint-disable-next-line no-console
        console.log(
          "⚠️  This gateway uses WhatsApp Web (non-official). It can be unstable and may lead to account restrictions."
        );
        // eslint-disable-next-line no-console
        console.log("📱 Use a dedicated number.");
        const ok = await askYesNo(rl, "Do you accept this risk? (yes/no) ");
        if (!ok) {
          // eslint-disable-next-line no-console
          console.log("❌ Setup cancelled.\n");
          return;
        }

        // eslint-disable-next-line no-console
        console.log("✅ Starting WhatsApp...\n");
        await params.gateway.start();
        // eslint-disable-next-line no-console
        console.log("If a QR is required, it will be displayed above.\n");

        const snapshot = params.status.getSnapshot();
        if (!snapshot.paired) {
          // eslint-disable-next-line no-console
          console.log("🔐 Pair your phone (one-time):");
          // eslint-disable-next-line no-console
          console.log(`Send this message to the gateway number: PAIR ${params.gateway.getPairingCode()}`);
          // eslint-disable-next-line no-console
          console.log("Once paired, you can chat normally. Try /status.\n");
        }
      } finally {
        busy = false;
      }
      return;
    }

    if (cmd === "/update" || cmd === "update") {
      busy = true;
      try {
        await runSelfUpdate({ rootDir: params.rootDir, rl });
      } finally {
        busy = false;
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log("❓ Unknown command. Type /help.");
  };

  rl.on("line", (line) => void handleLine(line));
  rl.on("close", () => {
    // eslint-disable-next-line no-console
    console.log("Bye.");
    process.exit(0);
  });
}
