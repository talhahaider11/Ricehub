import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NativeCameraActions from "./NativeCameraActions";

describe("NativeCameraActions", () => {
  it("offers native photo and video capture as separate choices", () => {
    const onCapture = vi.fn();
    render(<NativeCameraActions onCapture={onCapture} />);
    const photoInput = screen.getByLabelText("Capture a photo");
    const videoInput = screen.getByLabelText("Record a video");
    const photoInputClick = vi.spyOn(photoInput, "click");
    const videoInputClick = vi.spyOn(videoInput, "click");

    expect(photoInput).toHaveAttribute("accept", "image/*");
    expect(photoInput).toHaveAttribute("capture", "environment");
    expect(videoInput).toHaveAttribute("accept", "video/*");
    expect(videoInput).toHaveAttribute("capture", "environment");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Take photo" }));
    expect(photoInputClick).toHaveBeenCalledOnce();
    expect(videoInputClick).not.toHaveBeenCalled();

    const photo = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [photo] } });
    expect(onCapture).toHaveBeenCalledWith(photo, "image");
    expect(photoInput.value).toBe("");
  });

  it("opens the video recorder when Record a video is selected", () => {
    const onCapture = vi.fn();
    render(<NativeCameraActions onCapture={onCapture} />);
    const photoInput = screen.getByLabelText("Capture a photo");
    const videoInput = screen.getByLabelText("Record a video");
    const photoInputClick = vi.spyOn(photoInput, "click");
    const videoInputClick = vi.spyOn(videoInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Record a video" }));
    expect(videoInputClick).toHaveBeenCalledOnce();
    expect(photoInputClick).not.toHaveBeenCalled();

    const video = new File(["video"], "camera.mp4", { type: "video/mp4" });
    fireEvent.change(videoInput, { target: { files: [video] } });
    expect(onCapture).toHaveBeenCalledWith(video, "video");
    expect(videoInput.value).toBe("");
  });
});
