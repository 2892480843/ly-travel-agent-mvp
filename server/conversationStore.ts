import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export type StoredUiMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const MODEL_HISTORY_LIMIT = 12;
const MODEL_MESSAGE_MAX_CHARS = 2000;
const TITLE_MAX_CHARS = 24;

export function getOrCreateConversation(userId: string, conversationId?: string, forceNew = false): ConversationRow {
  const db = getDb();
  if (!forceNew && conversationId) {
    const existing = db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
      .get(conversationId, userId) as ConversationRow | undefined;
    if (existing) return existing;
  }
  if (!forceNew) {
    const latest = db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
      .get(userId) as ConversationRow | undefined;
    if (latest) return latest;
  }
  const now = new Date().toISOString();
  const row: ConversationRow = { id: randomUUID(), user_id: userId, title: "新对话", created_at: now, updated_at: now };
  db.prepare("INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(row.id, row.user_id, row.title, row.created_at, row.updated_at);
  return row;
}

export function appendUserMessage(conversationId: string, content: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, 'user', ?, ?)")
    .run(conversationId, content, now);
  // First user message names the conversation.
  db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND title = '新对话'")
    .run(content.slice(0, TITLE_MAX_CHARS), now, conversationId);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
}

export function appendAssistantMessage(conversationId: string, content: string, uiMessageJson?: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO chat_messages (conversation_id, role, content, ui_message_json, created_at) VALUES (?, 'assistant', ?, ?, ?)")
    .run(conversationId, content, uiMessageJson ?? null, now);
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
}

/** Full UIMessage replay for the chat UI; broken JSON degrades to a text part. */
export function listUiMessages(conversationId: string): StoredUiMessage[] {
  const rows = getDb().prepare(
    "SELECT id, role, content, ui_message_json FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC"
  ).all(conversationId) as Array<{ id: number; role: "user" | "assistant"; content: string; ui_message_json: string | null }>;
  return rows.map((row) => {
    if (row.role === "assistant" && row.ui_message_json) {
      try {
        const parsed = JSON.parse(row.ui_message_json) as StoredUiMessage;
        if (parsed && Array.isArray(parsed.parts)) {
          return { ...parsed, id: parsed.id ?? `db-${row.id}`, role: "assistant" };
        }
      } catch {
        // fall through to plain text
      }
    }
    return {
      id: `db-${row.id}`,
      role: row.role,
      parts: [{ type: "text", text: row.content }]
    };
  });
}

/** Plain-text history for the model (tool transcripts intentionally excluded). */
export function listModelHistory(conversationId: string, limit = MODEL_HISTORY_LIMIT): Array<{ role: "user" | "assistant"; content: string }> {
  const rows = getDb().prepare(
    "SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?"
  ).all(conversationId, limit) as Array<{ role: "user" | "assistant"; content: string }>;
  return rows.reverse().map((row) => ({
    role: row.role,
    content: row.content.length > MODEL_MESSAGE_MAX_CHARS ? `${row.content.slice(0, MODEL_MESSAGE_MAX_CHARS)}…` : row.content
  }));
}
