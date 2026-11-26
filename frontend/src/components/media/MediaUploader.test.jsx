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

  it("offers separate camera inputs and uploads both file types", async () => {
    const onUploaded = vi.fn();
    const onFileSelected = vi.fn();
    render(
      <MediaUploader
        maxFiles={2}
        multiple={false}
        onUploaded={onUploaded}
        onFileSelected={onFileSelected}
      />
    );

    const photoInput = screen.getByLabelText("Capture a photo");
    const videoInput = screen.getByLabelText("Record a video");
    expect(photoInput).toHaveAttribute("accept", "image/*");
    expect(photoInput).toHaveAttribute("capture", "environment");
    expect(videoInput).toHaveAttribute("accept", "video/*");
    expect(videoInput).toHaveAttribute("capture", "environment");
    const galleryInput = document.querySelector(".media-uploader-file input");
    expect(galleryInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
    );
    expect(galleryInput).not.toHaveAttribute("capture");
    const clickPhotoInput = vi.spyOn(photoInput, "click");
    const clickVideoInput = vi.spyOn(videoInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Take photo" }));
    expect(clickPhotoInput).toHaveBeenCalledOnce();
    const photo = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [photo] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Camera" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Record a video" }));
    expect(clickVideoInput).toHaveBeenCalledOnce();
    const video = new File(["video"], "camera.mp4", { type: "video/mp4" });
    fireEvent.change(videoInput, { target: { files: [video] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(
        photo,
        "image",
        expect.any(Function),
        "post"
      );
      expect(uploadMedia).toHaveBeenCalledWith(
        video,
        "video",
        expect.any(Function),
        "post"
      );
      expect(onUploaded).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({ id: 21, media_type: "image" }),
      ], [photo]);
      expect(onUploaded).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({ id: 21, media_type: "video" }),
      ], [video]);
    });
    expect(onFileSelected).toHaveBeenCalledWith(photo, "image");
    expect(onFileSelected).toHaveBeenCalledWith(video, "video");
    expect(photoInput).toHaveValue("");
    expect(videoInput).toHaveValue("");
  });
});
