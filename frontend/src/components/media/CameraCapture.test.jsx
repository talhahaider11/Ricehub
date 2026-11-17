import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CameraCapture from "./CameraCapture";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  static instances = [];

  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType || "video/webm";
    this.state = "inactive";
    this.stop = vi.fn(() => {
      this.state = "inactive";
      this.ondataavailable?.({
        data: new Blob(["video"], { type: this.mimeType }),
      });
      this.onstop?.();
    });
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeMediaRecorder.instances = [];
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
  if (userAgentDescriptor) {
    Object.defineProperty(navigator, "userAgent", userAgentDescriptor);
  } else {
    delete navigator.userAgent;
  }
});

describe("CameraCapture", () => {
  it("requests camera access, captures a photo, and releases the camera", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["photo"], { type: "image/jpeg" }));
    });
    const onCapture = vi.fn().mockResolvedValue(undefined);

    render(<CameraCapture onCapture={onCapture} />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    await screen.findByRole("dialog", { name: "Camera" });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    const video = screen.getByLabelText("Camera preview");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
    const shutter = screen.getByRole("button", { name: /hold to record video/i });
    fireEvent.pointerDown(shutter, { button: 0 });
    fireEvent.pointerUp(shutter, { button: 0 });

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledOnce();
      expect(onCapture.mock.calls[0][0]).toMatchObject({
        type: "image/jpeg",
      });
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("shows guidance if camera permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          Object.assign(new Error("Permission denied"), { name: "NotAllowedError" })
        ),
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });

    render(<CameraCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera access was denied."
    );
  });

  it("opens an in-app camera on mobile without camera-switch controls", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile",
    });
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    const onCapture = vi.fn().mockResolvedValue(undefined);
    render(<CameraCapture onCapture={onCapture} />);

    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    expect(await screen.findByRole("dialog", { name: "Camera" })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Switch to front camera" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch to back camera" }))
      .not.toBeInTheDocument();
  });

  it("records while the shutter is held and automatically stops at 30 seconds", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const onCapture = vi.fn().mockResolvedValue(undefined);

    render(<CameraCapture onCapture={onCapture} />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByRole("dialog", { name: "Camera" });
    const shutter = screen.getByRole("button", { name: /hold to record video/i });

    vi.useFakeTimers();
    fireEvent.pointerDown(shutter, { button: 0 });
    act(() => vi.advanceTimersByTime(350));

    const recorder = FakeMediaRecorder.instances[0];
    expect(recorder).toBeDefined();
    expect(recorder.state).toBe("recording");
    act(() => vi.advanceTimersByTime(29_999));
    expect(recorder.stop).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(onCapture).toHaveBeenCalledOnce();
    expect(onCapture.mock.calls[0][0]).toMatchObject({
      type: "video/webm",
      name: expect.stringMatching(/\.webm$/),
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("stops and returns the recorded video when the shutter is released", async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const onCapture = vi.fn().mockResolvedValue(undefined);

    render(<CameraCapture onCapture={onCapture} />);
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByRole("dialog", { name: "Camera" });
    const shutter = screen.getByRole("button", { name: /hold to record video/i });

    vi.useFakeTimers();
    fireEvent.pointerDown(shutter, { button: 0 });
    act(() => vi.advanceTimersByTime(350));
    const recorder = FakeMediaRecorder.instances[0];
    expect(recorder.state).toBe("recording");

    fireEvent.pointerUp(shutter, { button: 0 });
    await act(async () => Promise.resolve());

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(onCapture).toHaveBeenCalledOnce();
    expect(onCapture.mock.calls[0][0]).toMatchObject({ type: "video/webm" });
  });
});
