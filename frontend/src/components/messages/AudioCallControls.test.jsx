import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CallContext } from "../../context/CallContext";
import AudioCallControls, { AudioCallButtons } from "./AudioCallControls";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const peerConnectionDescriptor = Object.getOwnPropertyDescriptor(window, "RTCPeerConnection");
const mediaStreamDescriptor = Object.getOwnPropertyDescriptor(window, "MediaStream");
const setSinkIdDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "setSinkId"
);

function createStream() {
  const audioTrack = { kind: "audio", enabled: true, stop: vi.fn() };
  const tracks = [audioTrack];
  return {
    audioTrack,
    stream: {
      getTracks: () => tracks,
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    },
  };
}

class MockMediaStream {
  constructor(tracks) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }
}

class MockPeerConnection {
  constructor() {
    MockPeerConnection.lastInstance = this;
    this.senders = [];
    this.addTrack = vi.fn((track) => {
      const sender = {
        track,
        replaceTrack: vi.fn(async (replacementTrack) => {
          sender.track = replacementTrack;
        }),
      };
      this.senders.push(sender);
      return sender;
    });
    this.getSenders = vi.fn(() => this.senders);
    this.close = vi.fn();
    this.createOffer = vi.fn().mockResolvedValue({
      type: "offer",
      sdp: "v=0\r\nm=audio\r\n",
    });
    this.createAnswer = vi.fn().mockResolvedValue({
      type: "answer",
      sdp: "v=0\r\nm=audio\r\n",
    });
    this.setLocalDescription = vi.fn(async (description) => {
      this.localDescription = description;
    });
    this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
    this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
  }
}

const peer = { id: 2, first_name: "Sam", last_name: "User" };
const callId = "11111111-1111-4111-8111-111111111111";

function renderCall(overrides = {}) {
  const activeCall = overrides.activeCall === undefined
    ? {
      peer,
      peerId: 2,
      conversationId: 3,
      mode: "audio",
      callId,
      direction: "outgoing",
    }
    : overrides.activeCall;
  const context = {
    activeCall,
    callSignals: [],
    clearActiveCall: vi.fn(),
    clearCallSignal: vi.fn(),
    connected: true,
    error: "",
    sendCallSignal: vi.fn(),
    startCall: vi.fn(),
    user: { id: 1, username: "me" },
    ...overrides,
  };
  return {
    context,
    ...render(
      <CallContext.Provider value={context}>
        <AudioCallControls />
      </CallContext.Provider>
    ),
  };
}

function firePointerEvent(element, type, properties) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  fireEvent(element, event);
}

function mockMedia(stream, getUserMedia = vi.fn().mockResolvedValue(stream)) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, "RTCPeerConnection", {
    configurable: true,
    value: MockPeerConnection,
  });
  Object.defineProperty(window, "MediaStream", {
    configurable: true,
    value: MockMediaStream,
  });
  return getUserMedia;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    delete navigator.mediaDevices;
  }
  if (secureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
  } else {
    delete window.isSecureContext;
  }
  if (peerConnectionDescriptor) {
    Object.defineProperty(window, "RTCPeerConnection", peerConnectionDescriptor);
  } else {
    delete window.RTCPeerConnection;
  }
  if (mediaStreamDescriptor) {
    Object.defineProperty(window, "MediaStream", mediaStreamDescriptor);
  } else {
    delete window.MediaStream;
  }
  if (setSinkIdDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", setSinkIdDescriptor);
  } else {
    delete HTMLMediaElement.prototype.setSinkId;
  }
});

describe("AudioCallControls", () => {
  it("starts calls from the chat header through the global call context", () => {
    const startCall = vi.fn();
    const context = {
      activeCall: null,
      connected: true,
      startCall,
    };

    render(
      <CallContext.Provider value={context}>
        <AudioCallButtons peer={peer} conversationId={3} />
      </CallContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));

    expect(startCall).toHaveBeenCalledWith({
      peer,
      conversationId: 3,
      mode: "audio",
    });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /video call/i })).not.toBeInTheDocument();
  });

  it("allows a voice call to start while the socket reconnects", () => {
    const startCall = vi.fn();

    render(
      <CallContext.Provider value={{
        activeCall: null,
        connected: false,
        startCall,
      }}>
        <AudioCallButtons peer={peer} conversationId={3} />
      </CallContext.Provider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));

    expect(startCall).toHaveBeenCalledWith({
      peer,
      conversationId: 3,
      mode: "audio",
    });
  });

  it("starts and ends an audio call, releasing the local tracks", async () => {
    const { stream, audioTrack } = createStream();
    const getUserMedia = mockMedia(stream);

    const { context } = renderCall();

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
      expect(context.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({
        peerId: 2,
        conversationId: 3,
        callId,
        signalType: "offer",
        signal: expect.objectContaining({ type: "offer" }),
      }));
    });

    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(context.sendCallSignal).toHaveBeenLastCalledWith(expect.objectContaining({
      signalType: "hangup",
      status: "cancelled",
    }));
    expect(audioTrack.stop).toHaveBeenCalledOnce();
  });

  it("routes call audio to the speaker and back to the earpiece", async () => {
    const { stream } = createStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: "audiooutput", deviceId: "speaker-output", label: "Phone speaker" },
      { kind: "audiooutput", deviceId: "earpiece-output", label: "Earpiece" },
    ]);
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
      configurable: true,
      value: setSinkId,
    });
    mockMedia(stream, getUserMedia);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    });
    const { context } = renderCall();

    await waitFor(() => expect(context.sendCallSignal).toHaveBeenCalledWith(
      expect.objectContaining({ signalType: "offer" })
    ));
    const audio = screen.getByLabelText("Remote call audio");
    const speakerButton = screen.getByRole("button", {
      name: "Turn speaker audio on",
    });

    fireEvent.click(speakerButton);
    await waitFor(() => expect(setSinkId).toHaveBeenLastCalledWith("speaker-output"));
    expect(audio).toHaveProperty("volume", 1);
    expect(speakerButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Turn speaker audio off" }));
    await waitFor(() => expect(setSinkId).toHaveBeenLastCalledWith("earpiece-output"));
  });

  it("minimizes an active call without ending it and restores it from the chat control", async () => {
    const { stream, audioTrack } = createStream();
    mockMedia(stream);
    const { context } = renderCall();

    await screen.findByRole("dialog", { name: "Sam User" });
    fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));

    expect(screen.queryByRole("dialog", { name: "Sam User" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to active call" })).toBeInTheDocument();
    expect(context.sendCallSignal).not.toHaveBeenCalledWith(expect.objectContaining({
      signalType: "hangup",
    }));
    expect(audioTrack.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Return to active call" }));
    expect(await screen.findByRole("dialog", { name: "Sam User" })).toBeInTheDocument();
  });

  it("ends an unanswered call after the ringing timeout", async () => {
    const { stream } = createStream();
    mockMedia(stream);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    const { context } = renderCall();
    await waitFor(() => {
      expect(context.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({
        signalType: "offer",
      }));
    });

    const timeout = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 30_000);
    expect(timeout).toBeDefined();
    act(() => timeout[0]());

    expect(context.sendCallSignal).toHaveBeenLastCalledWith(expect.objectContaining({
      signalType: "hangup",
      status: "unanswered",
    }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No answer");
  });

  it("shows incoming voice calls and allows the recipient to answer", async () => {
    const { stream } = createStream();
    const getUserMedia = mockMedia(stream);
    const signal = {
      id: 1,
        from_user_id: 2,
        signal_type: "offer",
        call_type: "audio",
        signal: { type: "offer", sdp: "v=0\r\nm=audio\r\n" },
    };
    const { context } = renderCall({
      activeCall: {
        peer,
        peerId: 2,
        conversationId: 3,
        mode: "audio",
        callId,
        direction: "incoming",
      },
      callSignals: [signal],
    });

    expect(await screen.findByRole("dialog", { name: "Sam User" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });
      expect(context.sendCallSignal).toHaveBeenCalledWith(expect.objectContaining({
        signalType: "answer",
      }));
    });
  });

  it("offers a retry when call media permission is denied", async () => {
    const { stream } = createStream();
    const denied = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    const getUserMedia = mockMedia(stream, vi.fn().mockRejectedValueOnce(denied));

    renderCall();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Microphone permission is required for audio calls"
    );
    expect(screen.getByRole("group")).toHaveTextContent("Allow microphone access");
    fireEvent.click(screen.getByRole("button", { name: "Try the call again" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
