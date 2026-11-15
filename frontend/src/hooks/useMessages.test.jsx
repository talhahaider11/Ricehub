import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useMessages from "./useMessages";

const mocks = vi.hoisted(() => ({
  messages: vi.fn(),
  sendText: vi.fn(),
  createSocket: vi.fn(),
}));

vi.mock("../services/messageService", () => ({
  default: {
    messages: mocks.messages,
    sendText: mocks.sendText,
    createSocket: mocks.createSocket,
  },
}));

vi.mock("./useAuth", () => ({
  default: () => ({ user: { id: 1 } }),
}));

describe("useMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messages.mockResolvedValue({ results: [] });
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
});
