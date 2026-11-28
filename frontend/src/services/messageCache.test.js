import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheConversations,
  cacheMessages,
  clearAllChatCaches,
  getCachedConversations,
  getCachedMessages,
  getMemoizedChatMediaUrl,
  isConversationCacheFresh,
} from "./messageCache";

describe("messageCache", () => {
  beforeEach(() => {
    clearAllChatCaches();
  });

  it("scopes cached conversations by user and freshness", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    try {
      const data = { results: [{ id: 8 }], next: null };
      cacheConversations(data, false, 5);

      expect(getCachedConversations(false, 5)?.data).toEqual(data);
      expect(getCachedConversations(false, 6)).toBeNull();
      expect(isConversationCacheFresh(getCachedConversations(false, 5))).toBe(true);

      vi.advanceTimersByTime(120_001);
      expect(isConversationCacheFresh(getCachedConversations(false, 5))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores the latest message page with its older-page cursor", () => {
    const messages = [{ id: 1 }, { id: 2 }];
    cacheMessages(42, 5, messages, {
      hasOlderMessages: true,
      nextPage: 3,
    });

    expect(getCachedMessages(42, 5)).toMatchObject({
      messages,
      hasOlderMessages: true,
      nextPage: 3,
    });
    expect(getCachedMessages(42, 6)).toBeNull();
  });

  it("keeps message metadata in the synchronous cache and evicts old persisted histories", () => {
    const message = {
      id: 1,
      attachment: "https://objectstorage.example.oraclecloud.com/chat/photo.jpg",
      attachment_type: "image",
    };
    cacheMessages(42, 5, [message]);

    expect(getCachedMessages(42, 5)?.mediaMetadata).toEqual([
      {
        id: 1,
        attachment: message.attachment,
        attachment_type: "image",
      },
    ]);
    expect(getMemoizedChatMediaUrl(42, 5, 1, message.attachment))
      .toBe(message.attachment);

    for (let conversationId = 1; conversationId <= 13; conversationId += 1) {
      cacheMessages(conversationId, 5, [{ id: conversationId }]);
    }

    const persistedMessageCacheKeys = Object.keys(localStorage)
      .filter((key) => key.startsWith("ricehub:message-cache:v1:"));
    expect(persistedMessageCacheKeys).toHaveLength(12);
    expect(localStorage.getItem("ricehub:message-cache:v1:5:42")).toBeNull();
  });

  it("uses the in-memory message snapshot even if storage is unavailable afterward", () => {
    const messages = [{ id: 3, content: "Cached" }];
    cacheMessages(42, 5, messages);
    localStorage.removeItem("ricehub:message-cache:v1:5:42");

    expect(getCachedMessages(42, 5)?.messages).toEqual(messages);
  });
});
