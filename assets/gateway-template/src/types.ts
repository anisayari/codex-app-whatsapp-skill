export type ReplyMode = "echo" | "webhook";

export type ConnectionState =
  | "idle"
  | "awaiting_consent"
  | "starting"
  | "awaiting_qr_scan"
  | "connected"
  | "disconnected"
  | "failed";

export interface InboundMessage {
  jid: string;
  messageId: string;
  text: string;
  timestampMs: number;
}

export interface StatusSnapshot {
  state: ConnectionState;
  active: boolean;
  jid: string | null;
  number: string | null;
  pushName: string | null;
  lastQrAt: string | null;
  lastConnectAt: string | null;
  lastDisconnectAt: string | null;
  lastError: string | null;
  lastMessageAt: string | null;
}

export interface PublicStatus {
  connection: "connected" | "connecting" | "disconnected";
  active: boolean;
  jid?: string;
  number?: string;
  push_name?: string;
  last_qr_at?: string;
  last_connect_at?: string;
  last_disconnect_at?: string;
  last_message_at?: string;
  last_error?: string;
}
