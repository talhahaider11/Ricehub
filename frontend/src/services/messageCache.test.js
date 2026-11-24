import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheConversations,
  cacheMessages,
  getCachedConversations,
  getCachedMessages,
  isConversationCacheFresh,
} from "./messageCache";

describe("messageCache", () => {
  beforeEach(() => {
    localStorage.clear();
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
});
