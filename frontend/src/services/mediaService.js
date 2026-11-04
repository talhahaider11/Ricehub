import imageCompression from "browser-image-compression";
import api from "./api";

export async function prepareImage(file) {
  if (!file.type.startsWith("image/")) return file;

  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
  });
}

export async function uploadMedia(file, mediaType, onUploadProgress) {
  const preparedFile = mediaType === "image" ? await prepareImage(file) : file;
  const formData = new FormData();
  formData.append("file", preparedFile, preparedFile.name || file.name);
  formData.append("media_type", mediaType);

  const response = await api.post("/media/upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data;
}

export async function deleteMedia(mediaId) {
  await api.delete(`/media/${mediaId}/`);
}

export async function getMediaAsset(mediaId) {
  const response = await api.get(`/media/${mediaId}/`);
  return response.data;
}
