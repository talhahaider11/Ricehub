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

  it("opens one native photo-or-video camera input and uploads either file type", async () => {
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

    const cameraInput = screen.getByLabelText("Capture a photo or video");
    expect(cameraInput).toHaveAttribute("accept", "image/*,video/*");
    expect(cameraInput).toHaveAttribute("capture", "environment");
    const galleryInput = document.querySelector(".media-uploader-file input");
    expect(galleryInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
    );
    expect(galleryInput).not.toHaveAttribute("capture");
    const clickInput = vi.spyOn(cameraInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    expect(clickInput).toHaveBeenCalledOnce();
    const photo = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
    fireEvent.change(cameraInput, { target: { files: [photo] } });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Camera" })).toBeEnabled();
    });
    const video = new File(["video"], "camera.mp4", { type: "video/mp4" });
    fireEvent.change(cameraInput, { target: { files: [video] } });

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
      ], [photo]);
      expect(onUploaded).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({ id: 21, media_type: "video" }),
      ], [video]);
    });
    expect(onFileSelected).toHaveBeenCalledWith(photo, "image");
    expect(onFileSelected).toHaveBeenCalledWith(video, "video");
    expect(cameraInput).toHaveValue("");
  });
});
