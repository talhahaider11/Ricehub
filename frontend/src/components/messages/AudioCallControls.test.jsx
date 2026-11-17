import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudioCallControls from "./AudioCallControls";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const peerConnectionDescriptor = Object.getOwnPropertyDescriptor(window, "RTCPeerConnection");
const mediaStreamDescriptor = Object.getOwnPropertyDescriptor(window, "MediaStream");

function createStream() {
  const audioTrack = { kind: "audio", enabled: true, stop: vi.fn() };
  const videoTrack = { kind: "video", enabled: true, stop: vi.fn() };
  const tracks = [audioTrack, videoTrack];
  return {
    audioTrack,
    videoTrack,
    stream: {
      getTracks: () => tracks,
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [videoTrack],
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
      sdp: "v=0\r\nm=audio\r\nm=video\r\n",
    });
    this.createAnswer = vi.fn().mockResolvedValue({
      type: "answer",
      sdp: "v=0\r\nm=audio\r\nm=video\r\n",
    });
    this.setLocalDescription = vi.fn(async (description) => {
      this.localDescription = description;
    });
    this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
    this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
  }
}

function renderCall(overrides = {}) {
  return render(
    <AudioCallControls
      peerId={2}
      peer={{ id: 2, first_name: "Sam", last_name: "User" }}
      currentUser={{ id: 1, username: "me" }}
      disabled={false}
      callSignal={null}
      sendCallSignal={vi.fn()}
      clearCallSignal={vi.fn()}
      {...overrides}
    />
  );
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
});

describe("AudioCallControls", () => {
  it("starts and ends an audio call, releasing the local tracks", async () => {
    const { stream, audioTrack, videoTrack } = createStream();
    const getUserMedia = mockMedia(stream);
    const sendCallSignal = vi.fn();

    renderCall({ sendCallSignal });
    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
      expect(sendCallSignal).toHaveBeenCalledWith(
        2,
        "offer",
        expect.objectContaining({ type: "offer" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(sendCallSignal).toHaveBeenLastCalledWith(2, "hangup", { mode: "audio" });
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it("minimizes an active call without ending it and restores it from the chat control", async () => {
    const { stream, audioTrack } = createStream();
    const sendCallSignal = vi.fn();
    mockMedia(stream);
    renderCall({ sendCallSignal });

    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));
    await screen.findByRole("dialog", { name: "Sam User" });
    fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));

    expect(screen.queryByRole("dialog", { name: "Sam User" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to active call" })).toBeInTheDocument();
    expect(sendCallSignal).not.toHaveBeenCalledWith(2, "hangup", expect.anything());
    expect(audioTrack.stop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Return to active call" }));
    expect(await screen.findByRole("dialog", { name: "Sam User" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start video call" })).not.toBeInTheDocument();
  });

  it("ends an unanswered call after the ringing timeout", async () => {
    const { stream } = createStream();
    mockMedia(stream);
    const sendCallSignal = vi.fn();
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    renderCall({ sendCallSignal });
    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));
    await waitFor(() => {
      expect(sendCallSignal).toHaveBeenCalledWith(
        2,
        "offer",
        expect.objectContaining({ type: "offer" })
      );
    });

    const timeout = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 30_000);
    expect(timeout).toBeDefined();
    act(() => timeout[0]());

    expect(sendCallSignal).toHaveBeenLastCalledWith(2, "hangup", { mode: "audio" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No answer");
  });

  it("automatically rejects incoming video calls", async () => {
    const sendCallSignal = vi.fn();
    renderCall({
      callSignal: {
        from_user_id: 2,
        signal_type: "offer",
        signal: { type: "offer", sdp: "v=0\r\nm=video\r\n" },
      },
      sendCallSignal,
    });

    await waitFor(() => {
      expect(sendCallSignal).toHaveBeenCalledWith(2, "hangup", { mode: "video" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start audio call" })).toBeInTheDocument();
  });

  it("offers a retry when call media permission is denied", async () => {
    const { stream } = createStream();
    const denied = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    const getUserMedia = mockMedia(stream, vi.fn().mockRejectedValueOnce(denied));

    renderCall();
    fireEvent.click(screen.getByRole("button", { name: "Start audio call" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Microphone permission is required for audio calls"
    );
    expect(screen.getByRole("group")).toHaveTextContent("Allow Camera and Microphone");
    fireEvent.click(screen.getByRole("button", { name: "Try the call again" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
