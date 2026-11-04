const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|webp)$/i;
const VIDEO_EXTENSIONS = /\.(?:mp4|webm|mov)$/i;

export function getMediaType(file) {
  if (file.type?.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name)) {
    return "image";
  }
  if (file.type?.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name)) {
    return "video";
  }
  return null;
}

export function formatFileSize(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
}
