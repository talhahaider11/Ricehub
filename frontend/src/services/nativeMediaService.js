import { Capacitor } from "@capacitor/core";
import {
  Camera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";

export const NativeMediaSource = {
  CAMERA: CameraSource.Camera,
  PHOTOS: CameraSource.Photos,
  PROMPT: CameraSource.Prompt,
};

export async function pickPhoto(source = CameraSource.Prompt) {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const permissionType = source === CameraSource.Camera ? "camera" : "photos";
  const hasPermission = (value) =>
    value === "granted" || (permissionType === "photos" && value === "limited");
  let permissions = await Camera.checkPermissions();
  if (!hasPermission(permissions[permissionType])) {
    permissions = await Camera.requestPermissions({
      permissions: [permissionType],
    });
  }
  if (!hasPermission(permissions[permissionType])) {
    throw new Error(
      permissionType === "photos"
        ? "Photo library access is required to select an image."
        : "Camera access is required to take a photo."
    );
  }

  return Camera.getPhoto({
    source,
    resultType: CameraResultType.Uri,
    quality: 85,
  });
}
