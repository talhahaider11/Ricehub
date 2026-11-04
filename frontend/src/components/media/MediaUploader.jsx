import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ImagePlus, Video } from "lucide-react";

import {
  MAX_POST_IMAGE_SIZE,
  MAX_POST_VIDEO_SIZE,
} from "../../utils/constants";
import { uploadMedia } from "../../services/mediaService";
import {
  NativeMediaSource,
  pickPhoto,
} from "../../services/nativeMediaService";
import { getMediaType } from "../../utils/media";
import UploadProgress from "./UploadProgress";

function getErrorMessage(error) {
  return (
    error.response?.data?.file?.[0] ||
    error.response?.data?.detail ||
    error.message ||
    "Upload failed."
  );
}

export default function MediaUploader({
  maxFiles = 10,
  onUploaded,
  accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime",
  multiple = true,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const isNative = Capacitor.isNativePlatform();

  async function uploadFiles(files) {
    if (!files.length) return;
    if (files.length > maxFiles) {
      setError(`You can add up to ${maxFiles} more media files.`);
      return;
    }

    setError("");
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of files) {
        const mediaType = getMediaType(file);
        const sizeLimit = mediaType === "image"
          ? MAX_POST_IMAGE_SIZE
          : MAX_POST_VIDEO_SIZE;
        if (!mediaType) {
          throw new Error(`Unsupported file: ${file.name}`);
        }
        if (file.size > sizeLimit) {
          throw new Error(
            `${file.name} exceeds the ${mediaType === "image" ? "5 MB" : "100 MB"} limit.`
          );
        }

        setFilename(file.name);
        setProgress(0);
        const asset = await uploadMedia(file, mediaType, (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        uploaded.push(asset);
      }
      onUploaded?.(uploaded);
    } catch (uploadError) {
      if (uploaded.length) onUploaded?.(uploaded);
      setError(getErrorMessage(uploadError));
    } finally {
      setUploading(false);
      setFilename("");
    }
  }

  async function chooseNativePhoto(source) {
    setError("");
    try {
      const photo = await pickPhoto(source);
      if (!photo) {
        return;
      }
      if (!photo.webPath) {
        throw new Error("The selected photo could not be opened.");
      }
      const response = await fetch(photo.webPath);
      if (!response.ok) {
        throw new Error("The selected photo could not be read.");
      }
      const blob = await response.blob();
      const file = new File(
        [blob],
        `ricehub-photo-${Date.now()}.jpg`,
        { type: blob.type || "image/jpeg" }
      );
      await uploadFiles([file]);
    } catch (cameraError) {
      if (cameraError.message !== "User cancelled photos app") {
        setError(getErrorMessage(cameraError));
      }
    }
  }

  return (
    <div className="media-uploader">
      <label className="media-uploader-file">
        <ImagePlus size={18} />
        Add photos/videos
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={uploading || maxFiles <= 0}
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
      </label>

      {isNative && (
        <div className="media-native-actions">
          <button
            type="button"
            disabled={uploading || maxFiles <= 0}
            onClick={() => void chooseNativePhoto(NativeMediaSource.CAMERA)}
          >
            <Camera size={17} /> Take photo
          </button>
          <button
            type="button"
            disabled={uploading || maxFiles <= 0}
            onClick={() => void chooseNativePhoto(NativeMediaSource.PHOTOS)}
          >
            <ImagePlus size={17} /> Choose photo
          </button>
          <span><Video size={16} /> Video: use Add photos/videos</span>
        </div>
      )}

      {uploading && <UploadProgress progress={progress} filename={filename} />}
      {maxFiles <= 0 && <p className="muted">Maximum of 10 media files reached.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
