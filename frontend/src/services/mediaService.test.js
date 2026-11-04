import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import imageCompression from "browser-image-compression";
import {
  deleteMedia,
  getMediaAsset,
  prepareImage,
  uploadMedia,
} from "./mediaService";

vi.mock("./api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

describe("mediaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compresses image files before uploading", async () => {
    const source = new File(["original"], "photo.png", { type: "image/png" });
    const compressed = new File(["small"], "photo.png", { type: "image/png" });
    imageCompression.mockResolvedValue(compressed);
    api.post.mockResolvedValue({ data: { id: 8 } });

    await uploadMedia(source, "image");

    expect(imageCompression).toHaveBeenCalledWith(
      source,
      expect.objectContaining({ maxSizeMB: 2, maxWidthOrHeight: 2048 })
    );
    expect(api.post).toHaveBeenCalledWith(
      "/media/upload/",
      expect.any(FormData),
      expect.objectContaining({ onUploadProgress: undefined })
    );
  });

  it("does not compress videos", async () => {
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
    api.post.mockResolvedValue({ data: { id: 9 } });

    await uploadMedia(video, "video");

    expect(imageCompression).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith(
      "/media/upload/",
      expect.any(FormData),
      expect.any(Object)
    );
  });

  it("returns non-image inputs unchanged from prepareImage", async () => {
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });

    await expect(prepareImage(video)).resolves.toBe(video);
    expect(imageCompression).not.toHaveBeenCalled();
  });

  it("deletes only the requested unattached asset", async () => {
    api.delete.mockResolvedValue({});

    await deleteMedia(42);

    expect(api.delete).toHaveBeenCalledWith("/media/42/");
  });

  it("loads the current user's media processing status", async () => {
    api.get.mockResolvedValue({
      data: { id: 42, processing_status: "ready" },
    });

    await expect(getMediaAsset(42)).resolves.toEqual({
      id: 42,
      processing_status: "ready",
    });
    expect(api.get).toHaveBeenCalledWith("/media/42/");
  });
});
