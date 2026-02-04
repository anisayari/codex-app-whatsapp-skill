import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function normalizeJid(jid: string): string {
  return jidNormalizedUser(jid);
}

function numberToJid(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  return normalizeJid(`${digits}@s.whatsapp.net`);
}

function parsePairCommand(text: string): string | null {
  const trimmed = text.trim();
  const match = /^\/?pair\s+([0-9]{6,12})$/i.exec(trimmed);
  return match?.[1] ?? null;
}

function generatePairCode(): string {
  const value = randomInt(10000000, 99999999);
  return String(value);
}

interface OwnerStateFile {
  ownerJids: string[];
}

export class OwnerStore {
  private readonly ownerJids = new Set<string>();
  private pairingCode: string;
  private readonly stateFilePath: string;

  constructor(params: { authStateDir: string; ownerNumbersFromEnv: string[]; ownerJidsFromEnv: string[] }) {
    this.pairingCode = generatePairCode();
    this.stateFilePath = path.join(params.authStateDir, "owner.json");

    for (const n of params.ownerNumbersFromEnv) {
      const jid = numberToJid(n);
      if (jid) this.ownerJids.add(jid);
    }

    for (const j of params.ownerJidsFromEnv) {
      const normalized = normalizeJid(j);
      if (normalized) this.ownerJids.add(normalized);
    }
  }

  async loadFromDisk(): Promise<void> {
    if (this.ownerJids.size > 0) return;

    try {
      const raw = await fs.readFile(this.stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as OwnerStateFile).ownerJids)
      ) {
        for (const jid of (parsed as OwnerStateFile).ownerJids) {
          if (typeof jid === "string" && jid.trim()) {
            this.ownerJids.add(normalizeJid(jid));
          }
        }
      }
    } catch {
      // No state file yet.
    }
  }

  isPaired(): boolean {
    return this.ownerJids.size > 0;
  }

  getOwnerJids(): string[] {
    return Array.from(this.ownerJids);
  }

  getPairingCode(): string {
    return this.pairingCode;
  }

  isAllowed(params: { jid: string; allowGroups: boolean }): boolean {
    if (params.jid.endsWith("@g.us")) {
      return params.allowGroups && this.ownerJids.has(params.jid);
    }

    return this.ownerJids.has(params.jid);
  }

  async tryPair(params: { jid: string; text: string }): Promise<boolean> {
    if (this.isPaired()) return false;

    const code = parsePairCommand(params.text);
    if (!code) return false;

    if (code !== this.pairingCode) return false;

    this.ownerJids.add(params.jid);
    await this.save();

    // Rotate pairing code after successful pair.
    this.pairingCode = generatePairCode();

    return true;
  }

  private async save(): Promise<void> {
    const dir = path.dirname(this.stateFilePath);
    await fs.mkdir(dir, { recursive: true });

    const payload: OwnerStateFile = {
      ownerJids: this.getOwnerJids(),
    };

    await fs.writeFile(this.stateFilePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
}
