import type { ConnectionState, PublicStatus, StatusSnapshot } from "./types";

function toIso(date: Date): string {
  return date.toISOString();
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export class StatusStore {
  private snapshot: StatusSnapshot;

  constructor() {
    this.snapshot = {
      state: "idle",
      active: false,
      paired: false,
      ownerJids: [],
      jid: null,
      number: null,
      pushName: null,
      lastQrAt: null,
      lastConnectAt: null,
      lastDisconnectAt: null,
      lastError: null,
      lastMessageAt: null,
    };
  }

  getSnapshot(): StatusSnapshot {
    return { ...this.snapshot };
  }

  setState(state: ConnectionState): void {
    this.snapshot = {
      ...this.snapshot,
      state,
      active: state === "connected" || state === "awaiting_qr_scan" || state === "starting",
    };
  }

  setUser(params: { jid: string | null; number: string | null; pushName: string | null }): void {
    this.snapshot = {
      ...this.snapshot,
      jid: params.jid,
      number: params.number,
      pushName: params.pushName,
    };
  }

  setOwners(ownerJids: string[]): void {
    this.snapshot = {
      ...this.snapshot,
      paired: ownerJids.length > 0,
      ownerJids: ownerJids.slice(),
    };
  }

  markQrSeen(): void {
    this.snapshot = {
      ...this.snapshot,
      lastQrAt: toIso(new Date()),
    };
  }

  markConnected(): void {
    this.snapshot = {
      ...this.snapshot,
      lastConnectAt: toIso(new Date()),
    };
  }

  markDisconnected(): void {
    this.snapshot = {
      ...this.snapshot,
      lastDisconnectAt: toIso(new Date()),
    };
  }

  markMessageSeen(): void {
    this.snapshot = {
      ...this.snapshot,
      lastMessageAt: toIso(new Date()),
    };
  }

  setError(err: unknown): void {
    this.snapshot = {
      ...this.snapshot,
      lastError: stringifyError(err),
    };
  }

  toPublicStatus(): PublicStatus {
    const connection: PublicStatus["connection"] =
      this.snapshot.state === "connected"
        ? "connected"
        : this.snapshot.state === "starting" || this.snapshot.state === "awaiting_qr_scan"
          ? "connecting"
          : "disconnected";

    const out: PublicStatus = {
      connection,
      active: this.snapshot.active,
    };

    out.paired = this.snapshot.paired;
    out.owner_jids = this.snapshot.ownerJids.slice();

    if (this.snapshot.jid) out.jid = this.snapshot.jid;
    if (this.snapshot.number) out.number = this.snapshot.number;
    if (this.snapshot.pushName) out.push_name = this.snapshot.pushName;
    if (this.snapshot.lastQrAt) out.last_qr_at = this.snapshot.lastQrAt;
    if (this.snapshot.lastConnectAt) out.last_connect_at = this.snapshot.lastConnectAt;
    if (this.snapshot.lastDisconnectAt) out.last_disconnect_at = this.snapshot.lastDisconnectAt;
    if (this.snapshot.lastMessageAt) out.last_message_at = this.snapshot.lastMessageAt;
    if (this.snapshot.lastError) out.last_error = this.snapshot.lastError;

    return out;
  }
}
