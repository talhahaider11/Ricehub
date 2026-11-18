import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messageService from "../services/messageService";
import { CallProvider, useCall } from "./CallContext";

const mocks = vi.hoisted(() => ({
  incomingCalls: vi.fn(),
  initiateCall: vi.fn(),
  refreshAccessToken: vi.fn(),
  sendCallSignal: vi.fn(),
}));

vi.mock("../services/api", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
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
  static instances = [];

  constructor(url) {
    this.url = url;
    MockWebSocket.lastUrl = url;
    MockWebSocket.instances.push(this);
    this.readyState = 0;
  }

  send = vi.fn();

  close = vi.fn();
}

function jwtWithExpiration(expiration) {
  const payload = btoa(JSON.stringify({ exp: expiration }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `header.${payload}.signature`;
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
    localStorage.setItem(
      "ricemarket_access_token",
      jwtWithExpiration(Math.floor(Date.now() / 1000) + 300)
    );
    mocks.incomingCalls.mockReset();
    mocks.initiateCall.mockReset();
    mocks.refreshAccessToken.mockReset();
    mocks.sendCallSignal.mockReset();
    MockWebSocket.lastUrl = undefined;
    MockWebSocket.instances = [];
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
    await waitFor(() => {
      expect(MockWebSocket.lastUrl).toMatch(/\/ws\/call-signaling\//);
    });
  });

  it("refreshes an expiring access token before opening the signaling socket", async () => {
    const refreshedToken = jwtWithExpiration(
      Math.floor(Date.now() / 1000) + 600
    );
    localStorage.setItem(
      "ricemarket_access_token",
      jwtWithExpiration(Math.floor(Date.now() / 1000) + 10)
    );
    mocks.refreshAccessToken.mockImplementation(async () => {
      localStorage.setItem("ricemarket_access_token", refreshedToken);
      return refreshedToken;
    });

    render(
      <CallProvider>
        <ActiveCall />
      </CallProvider>
    );

    await waitFor(() => {
      expect(MockWebSocket.lastUrl).toContain(
        encodeURIComponent(refreshedToken)
      );
    });
    expect(mocks.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it("reconnects immediately when the access token is refreshed", async () => {
    render(
      <CallProvider>
        <ActiveCall />
      </CallProvider>
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    const previousSocket = MockWebSocket.instances[0];
    const refreshedToken = jwtWithExpiration(
      Math.floor(Date.now() / 1000) + 600
    );
    localStorage.setItem("ricemarket_access_token", refreshedToken);

    window.dispatchEvent(new Event("token-refreshed"));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(MockWebSocket.lastUrl).toContain(
        encodeURIComponent(refreshedToken)
      );
    });
    expect(previousSocket.close).toHaveBeenCalledOnce();
  });
});
