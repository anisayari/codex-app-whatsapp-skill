# LLM Bridge Reference

Use this reference to implement the AI response path. Keep it provider-agnostic and wire the actual SDK based on official docs.

## Responsibilities
- Build a prompt with a system instruction and recent message history.
- Store per-jid conversation state and a rolling summary.
- Keep the response short and safe for WhatsApp.

## Minimal Store Shape
```ts
export interface ConversationState {
  jid: string;
  summary: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}
```

## Handler Skeleton
```ts
import type { InboundMessage } from "./types.js";

export interface LlmClient {
  generateReply: (input: {
    systemPrompt: string;
    summary: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    newUserMessage: string;
  }) => Promise<string>;
}

export class ConversationStore {
  private readonly byJid = new Map<string, ConversationState>();

  get(jid: string): ConversationState {
    return (
      this.byJid.get(jid) ?? {
        jid,
        summary: "",
        messages: [],
      }
    );
  }

  set(state: ConversationState): void {
    this.byJid.set(state.jid, state);
  }
}

export async function handleInbound(
  msg: InboundMessage,
  store: ConversationStore,
  llm: LlmClient
): Promise<string> {
  const state = store.get(msg.jid);
  const reply = await llm.generateReply({
    systemPrompt: process.env.SYSTEM_PROMPT || "You are a helpful assistant.",
    summary: state.summary,
    messages: state.messages,
    newUserMessage: msg.text,
  });

  const nextMessages = state.messages.concat([
    { role: "user", content: msg.text },
    { role: "assistant", content: reply },
  ]);

  store.set({
    ...state,
    messages: nextMessages.slice(-20),
  });

  return reply;
}
```

## Implementation Notes
- Implement `LlmClient.generateReply` using the official provider SDK and docs.
- Keep replies concise to fit WhatsApp UX.
- Add guardrails for profanity or sensitive content if required.
- If you exceed context limits, update `summary` by summarizing older turns.
