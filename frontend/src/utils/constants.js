// Environment Endpoints (Render / Production / Local)
export const API_URL =
  import.meta.env.VITE_API_URL || "https://ricehub-backend.onrender.com/api";
export const WS_URL =
  import.meta.env.VITE_WS_URL || "wss://ricehub-backend.onrender.com/ws";

const MEDIA_BASE_URL = API_URL.replace(/\/api\/?$/, "");

export function getMediaUrl(path) {
  if (!path) return path;
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("blob:")) {
    return path;
  }

  return `${MEDIA_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Application Brand Name
export const APP_NAME = "Ricemarket";

// Main Navigation Routing List
export const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Friends", path: "/friends" },
  { label: "Messages", path: "/messages" },
  { label: "Notifications", path: "/notifications" },
];

// Unified LocalStorage Key Identifiers
export const ACCESS_TOKEN_KEY = "ricemarket_access_token";
export const REFRESH_TOKEN_KEY = "ricemarket_refresh_token";
export const THEME_KEY = "ricemarket_theme";

// Upload Limits & Post Restrictions[cite: 4, 5]
export const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB[cite: 4, 5]
export const MAX_MESSAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB[cite: 4, 5]
export const MAX_POST_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 5000;