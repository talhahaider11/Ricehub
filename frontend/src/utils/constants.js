export const API_URL = import.meta.env.VITE_API_URL;
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
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