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
    expect(sendCallSignal).toHaveBeenLastCalledWith(2, "hangup", { mode: "video" });
    expect(audioTrack.stop).toHaveBeenCalledOnce();
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it("declines an incoming video call with its mode included in the hangup signal", async () => {
    const sendCallSignal = vi.fn();
    renderCall({
      callSignal: {
        from_user_id: 2,
        signal_type: "offer",
        signal: { type: "offer", sdp: "v=0\r\nm=video\r\n" },
      },
      sendCallSignal,
    });

    await screen.findByRole("dialog", { name: "Sam User" });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(sendCallSignal).toHaveBeenCalledWith(
      2,
      "hangup",
      { mode: "video" }
    );
  });

  it("switches the active video sender to the rear camera", async () => {
    const { stream, videoTrack } = createStream();
    const replacementTrack = { kind: "video", enabled: true, stop: vi.fn() };
    const replacementStream = new MockMediaStream([replacementTrack]);
    const getUserMedia = mockMedia(
      stream,
      vi.fn()
        .mockResolvedValueOnce(stream)
        .mockResolvedValueOnce(replacementStream)
    );

    renderCall();
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    const switchCameraButton = await screen.findByRole("button", {
      name: "Switch to back camera",
    });
    fireEvent.click(switchCameraButton);

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenNthCalledWith(2, {
        audio: false,
        video: { facingMode: { exact: "environment" } },
      });
    });
    await waitFor(() => {
      const videoSender = MockPeerConnection.lastInstance
        .getSenders().find((sender) => sender.track.kind === "video");
      expect(videoSender.replaceTrack).toHaveBeenCalledWith(replacementTrack);
      expect(screen.getByRole("button", { name: "Switch to front camera" })).toBeInTheDocument();
    });
    expect(videoTrack.stop).toHaveBeenCalledOnce();
  });

  it("reports when the requested camera is unavailable", async () => {
    const { stream } = createStream();
    const unavailable = Object.assign(new Error("No rear camera"), {
      name: "OverconstrainedError",
    });
    const getUserMedia = mockMedia(
      stream,
      vi.fn()
        .mockResolvedValueOnce(stream)
        .mockRejectedValueOnce(unavailable)
    );

    renderCall();
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    fireEvent.click(await screen.findByRole("button", { name: "Switch to back camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected camera is unavailable"
    );
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("keeps the self-video preview within the call stage while dragging", async () => {
    const { stream } = createStream();
    mockMedia(stream);

    renderCall();
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    const preview = await screen.findByRole("button", { name: "Move your video preview" });
    const stage = preview.closest(".call-screen-stage");
    Object.defineProperties(stage, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 400 },
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 100 },
      offsetHeight: { configurable: true, value: 120 },
    });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      right: 310,
      bottom: 420,
      width: 300,
      height: 400,
    });
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
      left: 210,
      top: 30,
      right: 310,
      bottom: 150,
      width: 100,
      height: 120,
    });

    firePointerEvent(preview, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 220,
      clientY: 40,
    });
    firePointerEvent(preview, "pointermove", {
      pointerId: 1,
      clientX: 1000,
      clientY: 1000,
    });

    expect(preview).toHaveStyle({ left: "200px", top: "280px" });
    firePointerEvent(preview, "pointerup", { pointerId: 1 });
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
