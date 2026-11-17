import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadMedia } from "../../services/mediaService";
import MediaUploader from "./MediaUploader";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("../../services/mediaService", () => ({
  uploadMedia: vi.fn(),
}));

describe("MediaUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMedia.mockImplementation((file, mediaType) => Promise.resolve({
      id: 21,
      media_type: mediaType,
      processing_status: "ready",
      original_filename: file.name,
    }));
  });

  it("captures photos and videos with separate native inputs and uploads both", async () => {
    const onUploaded = vi.fn();
    render(<MediaUploader maxFiles={2} multiple={false} onUploaded={onUploaded} />);

    const photoInput = screen.getByLabelText("Take photo");
    const videoInput = screen.getByLabelText("Record video");
    expect(photoInput).toHaveAttribute("accept", "image/*");
    expect(photoInput).toHaveAttribute("capture", "environment");
    expect(videoInput).toHaveAttribute("accept", "video/*");
    expect(videoInput).toHaveAttribute("capture", "environment");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Take photo" }));
    const photo = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [photo] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Camera" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Record video" }));
    const video = new File(["video"], "camera.mp4", { type: "video/mp4" });
    fireEvent.change(videoInput, { target: { files: [video] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(
        photo,
        "image",
        expect.any(Function)
      );
      expect(uploadMedia).toHaveBeenCalledWith(
        video,
        "video",
        expect.any(Function)
      );
      expect(onUploaded).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({ id: 21, media_type: "image" }),
      ]);
      expect(onUploaded).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({ id: 21, media_type: "video" }),
      ]);
    });
    expect(photoInput).toHaveValue("");
    expect(videoInput).toHaveValue("");
  });
});
