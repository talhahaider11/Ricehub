import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudioCallControls from "./AudioCallControls";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const peerConnectionDescriptor = Object.getOwnPropertyDescriptor(window, "RTCPeerConnection");

function createStream() {
  const audioTrack = { enabled: true, stop: vi.fn() };
  const videoTrack = { enabled: true, stop: vi.fn() };
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

class MockPeerConnection {
  constructor() {
    this.addTrack = vi.fn();
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
    expect(sendCallSignal).toHaveBeenLastCalledWith(2, "hangup");
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it("answers video calls and toggles microphone, camera, and speaker audio", async () => {
    const { stream, audioTrack, videoTrack } = createStream();
    const getUserMedia = mockMedia(stream);
    const callSignal = {
      from_user_id: 2,
      signal_type: "offer",
      signal: { type: "offer", sdp: "v=0\r\nm=video\r\n" },
    };
    const sendCallSignal = vi.fn();

    renderCall({ callSignal, sendCallSignal });
    expect(await screen.findByRole("dialog", { name: "Sam User" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: { facingMode: { ideal: "user" } },
      });
      expect(sendCallSignal).toHaveBeenCalledWith(
        2,
        "answer",
        expect.objectContaining({ type: "answer" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(audioTrack.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Turn camera off" }));
    expect(videoTrack.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Turn speaker audio off" }));
    expect(screen.getByRole("button", { name: "Turn speaker audio on" }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it("offers a retry when call media permission is denied", async () => {
    const { stream } = createStream();
    const denied = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    const getUserMedia = mockMedia(stream, vi.fn().mockRejectedValueOnce(denied));

    renderCall();
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera and microphone permission are required"
    );
    expect(screen.getByRole("group")).toHaveTextContent("Allow Camera and Microphone");
    fireEvent.click(screen.getByRole("button", { name: "Try the call again" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
