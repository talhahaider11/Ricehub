import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CameraCapture from "./CameraCapture";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    const video = screen.getByLabelText("Camera preview");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));

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

  it("launches native photo capture, switches cameras, and hides video recording", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile",
    });
    const onCapture = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<CameraCapture onCapture={onCapture} />);
    const photoInput = container.querySelector('input[accept="image/*"]');
    const photoInputClick = vi.spyOn(photoInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    expect(photoInputClick).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Camera preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Camera" })).not.toBeInTheDocument();
    expect(photoInput).toHaveAttribute("capture", "environment");

    fireEvent.click(screen.getByRole("button", { name: "Switch to front camera" }));
    expect(screen.getByText("Front camera")).toBeInTheDocument();
    expect(photoInput).toHaveAttribute("capture", "user");
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    expect(photoInputClick).toHaveBeenCalledTimes(2);
    const photoFile = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [photoFile] } });

    await waitFor(() => expect(onCapture).toHaveBeenLastCalledWith(photoFile));
    fireEvent.click(screen.getByRole("button", { name: "Switch to back camera" }));
    expect(photoInput).toHaveAttribute("capture", "environment");
    expect(container.querySelector('input[accept="video/*"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Record video" })).not.toBeInTheDocument();
  });
});
