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

vi.mock("./CameraCapture", () => ({
  default: function CameraCaptureMock({ onCapture }) {
    return (
      <button
        type="button"
        onClick={() => void onCapture(new File(["photo"], "camera.jpg", { type: "image/jpeg" }))}
      >
        Capture camera photo
      </button>
    );
  },
}));

describe("MediaUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMedia.mockResolvedValue({
      id: 21,
      media_type: "image",
      processing_status: "ready",
      original_filename: "camera.jpg",
    });
  });

  it("uploads a captured camera photo and returns its media asset", async () => {
    const onUploaded = vi.fn();
    render(<MediaUploader maxFiles={1} multiple={false} onUploaded={onUploaded} />);

    fireEvent.click(screen.getByRole("button", { name: "Capture camera photo" }));

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(
        expect.objectContaining({ name: "camera.jpg", type: "image/jpeg" }),
        "image",
        expect.any(Function)
      );
      expect(onUploaded).toHaveBeenCalledWith([
        expect.objectContaining({ id: 21, media_type: "image" }),
      ]);
    });
  });
});
