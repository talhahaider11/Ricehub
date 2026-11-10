import { useState } from "react";
import { ImagePlus } from "lucide-react";

import {
  MAX_POST_IMAGE_SIZE,
  MAX_POST_VIDEO_SIZE,
} from "../../utils/constants";
import { uploadMedia } from "../../services/mediaService";
import { getMediaType } from "../../utils/media";
import UploadProgress from "./UploadProgress";
import CameraCapture from "./CameraCapture";

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
  showCamera = true,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
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

      {showCamera && (
        <CameraCapture
          disabled={uploading || maxFiles <= 0}
          onCapture={(file) => uploadFiles([file])}
        />
      )}
      {uploading && <UploadProgress progress={progress} filename={filename} />}
      {maxFiles <= 0 && <p className="muted">Maximum of 10 media files reached.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
