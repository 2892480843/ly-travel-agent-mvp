import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, initializeDatabase } from "./db";
import {
  appendAssistantMessage,
  appendUserMessage,
  getOrCreateConversation,
  listModelHistory,
  listUiMessages
} from "./conversationStore";

const savedEnv = { ...process.env };

describe("conversationStore", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ":memory:";
    initializeDatabase();
  });

  afterEach(() => {
    closeDb();
    process.env = { ...savedEnv };
  });

  it("creates, reuses and titles conversations per user", () => {
    const created = getOrCreateConversation("visitor");
    expect(created.title).toBe("新对话");

    appendUserMessage(created.id, "帮我规划黄鹤楼一日游，下午去江滩，谢谢");
    const titled = getOrCreateConversation("visitor", created.id);
    expect(titled.title).toBe("帮我规划黄鹤楼一日游，下午去江滩，谢谢".slice(0, 24));

    const reused = getOrCreateConversation("visitor");
    expect(reused.id).toBe(created.id);

    const fresh = getOrCreateConversation("visitor", undefined, true);
    expect(fresh.id).not.toBe(created.id);

    const otherUsers = getOrCreateConversation("operator", created.id);
    expect(otherUsers.id).not.toBe(created.id);
  });

  it("replays UI messages and degrades broken json to text parts", () => {
    const conv = getOrCreateConversation("visitor", undefined, true);
    appendUserMessage(conv.id, "你好");
    appendAssistantMessage(conv.id, "好的", JSON.stringify({ id: "m1", role: "assistant", parts: [{ type: "text", text: "好的" }], metadata: { confidence: 0.8 } }));
    appendAssistantMessage(conv.id, "降级文本", "{broken json");

    const messages = listUiMessages(conv.id);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "你好" }] });
    expect(messages[1]).toMatchObject({ id: "m1", metadata: { confidence: 0.8 } });
    expect(messages[2].parts).toEqual([{ type: "text", text: "降级文本" }]);
  });

  it("limits and truncates model history in chronological order", () => {
    const conv = getOrCreateConversation("visitor", undefined, true);
    for (let index = 0; index < 15; index += 1) {
      appendUserMessage(conv.id, `问题 ${index}`);
    }
    appendAssistantMessage(conv.id, "答".repeat(3000));

    const history = listModelHistory(conv.id, 12);
    expect(history).toHaveLength(12);
    expect(history[history.length - 1].role).toBe("assistant");
    expect(history[history.length - 1].content.length).toBeLessThanOrEqual(2001);
    expect(history[0].content).toBe("问题 4");
  });
});
