import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import NativeCameraActions from "./NativeCameraActions";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));

describe("NativeCameraActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(true);
  });

  it("uses a short tap for native photo capture", () => {
    const onCapture = vi.fn();
    render(<NativeCameraActions onCapture={onCapture} />);
    const photoInput = screen.getByLabelText("Capture a photo");
    const videoInput = screen.getByLabelText("Record a video");
    const photoInputClick = vi.spyOn(photoInput, "click");
    const videoInputClick = vi.spyOn(videoInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));

    expect(photoInput).toHaveAttribute("accept", "image/*");
    expect(photoInput).toHaveAttribute("capture", "environment");
    expect(videoInput).toHaveAttribute("accept", "video/*");
    expect(videoInput).toHaveAttribute("capture", "environment");
    expect(photoInputClick).toHaveBeenCalledOnce();
    expect(videoInputClick).not.toHaveBeenCalled();

    const photo = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [photo] } });
    expect(onCapture).toHaveBeenCalledWith(photo, "image");
  });

  it("uses a 400ms press-and-hold for native video capture", () => {
    vi.useFakeTimers();
    const onCapture = vi.fn();
    render(<NativeCameraActions onCapture={onCapture} />);
    const trigger = screen.getByRole("button", { name: "Camera" });
    const photoInput = screen.getByLabelText("Capture a photo");
    const videoInput = screen.getByLabelText("Record a video");
    const photoInputClick = vi.spyOn(photoInput, "click");
    const videoInputClick = vi.spyOn(videoInput, "click");

    try {
      fireEvent.pointerDown(trigger);
      act(() => vi.advanceTimersByTime(400));
      expect(videoInputClick).toHaveBeenCalledOnce();
      fireEvent.pointerUp(trigger);
      fireEvent.click(trigger);

      expect(photoInputClick).not.toHaveBeenCalled();
      const video = new File(["video"], "camera.mp4", { type: "video/mp4" });
      fireEvent.change(videoInput, { target: { files: [video] } });
      expect(onCapture).toHaveBeenCalledWith(video, "video");
    } finally {
      vi.useRealTimers();
    }
  });
});
