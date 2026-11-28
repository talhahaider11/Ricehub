import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useMessages from "./useMessages";
import {
  cacheMessages,
  clearAllChatCaches,
} from "../services/messageCache";

const mocks = vi.hoisted(() => ({
  messages: vi.fn(),
  messagesSince: vi.fn(),
  sendText: vi.fn(),
  createSocket: vi.fn(),
}));

vi.mock("../services/messageService", () => ({
  default: {
    messages: mocks.messages,
    messagesSince: mocks.messagesSince,
    sendText: mocks.sendText,
    createSocket: mocks.createSocket,
  },
}));

vi.mock("./useAuth", () => ({
  default: () => ({ user: { id: 1 } }),
}));

describe("useMessages", () => {
  beforeEach(() => {
    clearAllChatCaches();
    vi.clearAllMocks();
    mocks.messages.mockResolvedValue({ results: [] });
    mocks.messagesSince.mockResolvedValue({ results: [], next: null });
    mocks.sendText.mockResolvedValue({
      id: 12,
      conversation: 42,
      content: "Hello",
      sender: { id: 1 },
    });
    mocks.createSocket.mockReturnValue({
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
    });
  });

  it("sends and appends text when the WebSocket is not connected", async () => {
    const { result } = renderHook(() => useMessages(42));
    await waitFor(() => expect(mocks.messages).toHaveBeenCalledWith(42));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mocks.sendText).toHaveBeenCalledWith(42, "Hello", undefined);
    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 12, content: "Hello" }),
    ]);
  });

  it("hydrates a cached conversation immediately and syncs only newer messages", async () => {
    const cachedMessages = [{
      id: 21,
      conversation: 42,
      content: "Cached attachment",
      attachment: "https://objectstorage.example.oraclecloud.com/chat/photo.jpg",
      attachment_type: "image",
      sender: { id: 2 },
    }];
    cacheMessages(42, 1, cachedMessages, {
      hasOlderMessages: true,
      nextPage: 2,
    });

    const { result } = renderHook(() => useMessages(42));

    expect(result.current.messages).toEqual(cachedMessages);
    expect(result.current.loading).toBe(false);
    await waitFor(() => {
      expect(mocks.messagesSince).toHaveBeenCalledWith(42, 21);
    });
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it("keeps a sent message if the initial history request finishes afterward", async () => {
    let resolveHistory;
    mocks.messages.mockReturnValue(new Promise((resolve) => {
      resolveHistory = resolve;
    }));
    const { result } = renderHook(() => useMessages(42));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });
    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      resolveHistory({ results: [] });
    });

    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 12, content: "Hello" }),
    ]);
  });

  it("processes queued call signals in order instead of dropping candidates", async () => {
    const socket = {
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
    };
    mocks.createSocket.mockReturnValue(socket);
    const { result } = renderHook(() => useMessages(42));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      socket.onmessage({
        data: JSON.stringify({
          type: "call_signal",
          signal_type: "offer",
          from_user_id: 2,
          signal: { type: "offer" },
        }),
      });
      socket.onmessage({
        data: JSON.stringify({
          type: "call_signal",
          signal_type: "ice_candidate",
          from_user_id: 2,
          signal: { candidate: "candidate" },
        }),
      });
    });

    expect(result.current.callSignal.signal_type).toBe("offer");
    act(() => result.current.clearCallSignal());
    expect(result.current.callSignal.signal_type).toBe("ice_candidate");
  });
});
