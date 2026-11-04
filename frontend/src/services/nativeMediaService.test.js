import { beforeEach, describe, expect, it, vi } from "vitest";

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { NativeMediaSource, pickPhoto } from "./nativeMediaService";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock("@capacitor/camera", () => ({
  Camera: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getPhoto: vi.fn(),
  },
  CameraResultType: { Uri: "uri" },
  CameraSource: {
    Camera: "camera",
    Photos: "photos",
    Prompt: "prompt",
  },
}));

describe("nativeMediaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips native camera calls in a web browser", async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);

    await expect(pickPhoto()).resolves.toBeNull();

    expect(Camera.getPhoto).not.toHaveBeenCalled();
  });

  it("opens the native photo picker and returns its result", async () => {
    const photo = { webPath: "file://photo.jpg" };
    Capacitor.isNativePlatform.mockReturnValue(true);
    Camera.checkPermissions.mockResolvedValue({
      camera: "granted",
      photos: "granted",
    });
    Camera.getPhoto.mockResolvedValue(photo);

    await expect(pickPhoto(NativeMediaSource.PHOTOS)).resolves.toBe(photo);

    expect(Camera.getPhoto).toHaveBeenCalledWith({
      source: CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 85,
    });
  });

  it("does not open the picker when photo access is denied", async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    Camera.checkPermissions.mockResolvedValue({
      camera: "prompt",
      photos: "prompt",
    });
    Camera.requestPermissions.mockResolvedValue({
      camera: "prompt",
      photos: "denied",
    });

    await expect(pickPhoto(NativeMediaSource.PHOTOS)).rejects.toThrow(
      "Photo library access is required to select an image."
    );
    expect(Camera.getPhoto).not.toHaveBeenCalled();
  });
});
