import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messageService from "../services/messageService";
import { CallProvider, useCall } from "./CallContext";

const mocks = vi.hoisted(() => ({
  incomingCalls: vi.fn(),
  initiateCall: vi.fn(),
  sendCallSignal: vi.fn(),
}));

vi.mock("../services/messageService", () => ({
  default: {
    incomingCalls: mocks.incomingCalls,
    initiateCall: mocks.initiateCall,
    sendCallSignal: mocks.sendCallSignal,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7 } }),
}));

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static lastUrl;

  constructor(url) {
    this.url = url;
    MockWebSocket.lastUrl = url;
    this.readyState = 0;
  }

  send = vi.fn();

  close = vi.fn();
}

function ActiveCall() {
  const { activeCall } = useCall();
  return (
    <output>
      {activeCall
        ? `Call from ${activeCall.peer.first_name}`
        : "No incoming call"}
    </output>
  );
}

describe("CallProvider REST recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ricemarket_access_token", "access-token");
    mocks.incomingCalls.mockReset();
    mocks.initiateCall.mockReset();
    mocks.sendCallSignal.mockReset();
    MockWebSocket.lastUrl = undefined;
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  it("raises an incoming call from the REST inbox when signaling is asleep", async () => {
    mocks.incomingCalls.mockResolvedValue([{
      type: "incoming_call",
      from_user_id: 12,
      caller_id: 12,
      caller_name: "Sam",
      caller_avatar: null,
      conversation_id: 31,
      call_id: "11111111-1111-4111-8111-111111111111",
      call_type: "audio",
      signal_type: "offer",
      signal: { type: "offer", sdp: "v=0\r\nm=audio\r\n" },
    }]);

    render(
      <CallProvider>
        <ActiveCall />
      </CallProvider>
    );

    expect(await screen.findByText("Call from Sam")).toBeInTheDocument();
    expect(messageService.incomingCalls).toHaveBeenCalledOnce();
    expect(MockWebSocket.lastUrl).toMatch(/\/ws\/call-signaling\//);
  });
});
