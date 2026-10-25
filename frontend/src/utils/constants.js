// Environment variables se URLs load honge, na hone par Render Live URLs fallback me chalenge
export const API_URL =
  import.meta.env.VITE_API_URL || "https://ricehub-umfd.onrender.com/api";

// Live WebSocket URL (HTTPS ke liye wss:// use hota hai)
export const WS_URL =
  import.meta.env.VITE_WS_URL || "wss://ricehub-umfd.onrender.com/ws";

const MEDIA_BASE_URL = API_URL.replace("/api", "");

export function getMediaUrl(path) {
  if (!path) return path;
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("blob:")) {
    return path;
  }

  return `${MEDIA_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export const APP_NAME = "RiceHub";

export const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Friends", path: "/friends" },
  { label: "Messages", path: "/messages" },
  { label: "Notifications", path: "/notifications" },
];

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const THEME_KEY = "theme";

export const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_MESSAGE_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_POST_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 5000;