import makeWASocket, {
  DisconnectReason,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";

import type { Config } from "./config";
import type { InboundMessage } from "./types";
import { qrToAscii, printQrToTerminal } from "./qr";
import { OwnerStore } from "./owner-store";
import { StatusStore } from "./status-store";

export interface QrSnapshot {
  raw: string;
  ascii: string;
  at: string;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function numberFromJid(jid: string): string {
  const beforeAt = jid.split("@")[0] || "";
  const withoutDevice = beforeAt.split(":")[0] || beforeAt;
  const digits = withoutDevice.replace(/\D/g, "");
  return digits ? `+${digits}` : jid;
}

function timestampToMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }

  if (typeof value === "bigint") {
    return Number(value) * 1000;
  }

  if (typeof value === "object" && value !== null) {
    const maybe = value as { toNumber?: () => number };
    if (typeof maybe.toNumber === "function") {
      return maybe.toNumber() * 1000;
    }
  }

  return 0;
}

export class WhatsAppGateway {
  private socket: WASocket | null = null;
  private readonly logger: pino.Logger;
  private qr: QrSnapshot | null = null;
  private restarting = false;
  private readonly seenMessageKeys = new Map<string, number>();
  private readonly lastReplyAtByJid = new Map<string, number>();

  constructor(
    private readonly config: Config,
    private readonly status: StatusStore,
    private readonly owners: OwnerStore,
    private readonly replier: (msg: InboundMessage) => Promise<string>
  ) {
    this.logger = pino({ level: config.logLevel });
  }

  getQr(): QrSnapshot | null {
    return this.qr;
  }

  getJid(): string | null {
    return this.status.getSnapshot().jid;
  }

  getPairingCode(): string {
    return this.owners.getPairingCode();
  }

  async start(): Promise<void> {
    if (this.socket) {
      this.logger.info("WhatsApp socket already started");
      return;
    }

    this.status.setState("starting");

    const { state, saveCreds } = await useMultiFileAuthState(this.config.authStateDir);

    const socket = makeWASocket({
      auth: state,
      logger: this.logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      printQRInTerminal: false,
    });

    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      if (update.qr) {
        this.status.setState("awaiting_qr_scan");
        this.status.markQrSeen();

        const ascii = await qrToAscii(update.qr);
        this.qr = { raw: update.qr, ascii, at: toIso(new Date()) };

        this.logger.info("QR received. Scan to authenticate.");
        printQrToTerminal(update.qr);
      }

      if (update.connection === "open") {
        this.status.setState("connected");
        this.status.markConnected();

        const jid = socket.user?.id ? jidNormalizedUser(socket.user.id) : "";
        const pushName = socket.user?.name || null;

        this.status.setUser({
          jid: jid || null,
          number: jid ? numberFromJid(jid) : null,
          pushName,
        });

        this.logger.info({ jid }, "Connected");

        this.status.setOwners(this.owners.getOwnerJids());
        if (!this.owners.isPaired()) {
          this.logger.warn(
            `Owner not paired yet. Send: PAIR ${this.owners.getPairingCode()} from your phone.`
          );
        }
      }

      if (update.connection === "close") {
        this.status.setState("disconnected");
        this.status.markDisconnected();

        const statusCode =
          (update.lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode ?? null;

        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.logger.warn({ statusCode, loggedOut }, "Connection closed");

        this.socket = null;

        if (loggedOut) {
          this.status.setState("failed");
          this.status.setError("Logged out. Run /init to re-authenticate.");
          return;
        }

        if (!this.restarting) {
          this.restarting = true;
          setTimeout(() => {
            this.restarting = false;
            void this.start().catch((err) => {
              this.status.setError(err);
              this.logger.error({ err }, "Reconnect failed");
            });
          }, 2000);
        }
      }
    });

    socket.ev.on("messages.upsert", async (event) => {
      if (event.type !== "notify") return;

      for (const message of event.messages) {
        if (!message.message) continue;
        if (message.key.fromMe) continue;

        const rawJid = message.key.remoteJid || "";
        const jid = jidNormalizedUser(rawJid);
        if (!jid) continue;

        const messageId = message.key.id || "";
        if (!messageId) continue;

        const text =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          "";

        const trimmed = text.trim();
        if (!trimmed) continue;

        const dedupeKey = `${jid}|${messageId}`;
        if (!this.markSeen(dedupeKey)) continue;

        const allowed = this.owners.isAllowed({ jid, allowGroups: this.config.allowGroups });
        if (!allowed) {
          const pairedNow = await this.owners.tryPair({ jid, text: trimmed });
          if (pairedNow) {
            this.status.setOwners(this.owners.getOwnerJids());
            await this.sendText(
              jid,
              [
                "✅ Paired successfully.",
                "You can now chat with your Codex from this WhatsApp account.",
                "Try: /status",
              ].join("\n")
            );
          }
          continue;
        }

        const inbound: InboundMessage = {
          jid,
          messageId,
          text: trimmed.slice(0, this.config.maxInboundChars),
          timestampMs: timestampToMs(message.messageTimestamp),
        };

        try {
          this.status.markMessageSeen();

          const cmd = inbound.text.trim().toLowerCase();
          if (cmd === "/status" || cmd === "status") {
            await this.sendText(jid, this.formatStatusForWhatsApp());
            continue;
          }

          if (cmd === "/help" || cmd === "help") {
            await this.sendText(
              jid,
              [
                "🟢 WhatsApp Codex Bridge",
                "",
                "Commands:",
                "- /status  Show connection + pairing status",
                "- /help    Show this help",
                "",
                "Chat:",
                "- Send any message to get a reply.",
              ].join("\n")
            );
            continue;
          }

          const reply = await this.safeReply(inbound);
          if (!reply) continue;
          await this.sendText(jid, reply);
        } catch (err) {
          this.status.setError(err);
          this.logger.error({ err }, "Failed to process inbound message");
        }
      }
    });
  }

  private formatStatusForWhatsApp(): string {
    const s = this.status.getSnapshot();

    const connection =
      s.state === "connected"
        ? "connected"
        : s.state === "starting" || s.state === "awaiting_qr_scan"
          ? "connecting"
          : "disconnected";

    const lines: string[] = ["📟 Status"];
    lines.push(`connection: ${connection}`);
    lines.push(`active: ${s.active ? "yes" : "no"}`);
    lines.push(`paired: ${s.paired ? "yes" : "no"}`);
    if (s.number) lines.push(`number: ${s.number}`);
    if (s.jid) lines.push(`jid: ${s.jid}`);
    if (s.lastMessageAt) lines.push(`last_message_at: ${s.lastMessageAt}`);
    if (s.lastError) lines.push(`last_error: ${s.lastError}`);
    return lines.join("\n");
  }

  private safeReply = async (msg: InboundMessage): Promise<string | null> => {
    // Very small per-jid throttle to reduce spam / loops.
    const now = Date.now();
    const last = this.lastReplyAtByJid.get(msg.jid) || 0;
    if (now - last < 1200) {
      return null;
    }

    const reply = await this.replier(msg);
    this.lastReplyAtByJid.set(msg.jid, now);
    return reply;
  };

  private markSeen(key: string): boolean {
    const now = Date.now();

    // Cleanup old entries opportunistically.
    for (const [k, exp] of this.seenMessageKeys) {
      if (exp <= now) this.seenMessageKeys.delete(k);
    }

    if (this.seenMessageKeys.has(key)) {
      return false;
    }

    this.seenMessageKeys.set(key, now + 5 * 60_000);
    return true;
  }

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Not connected. Run /init and scan the QR first.");
    }
    await this.socket.sendMessage(jid, { text });
  }
}
