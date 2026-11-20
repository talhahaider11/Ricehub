import axios from "axios";
export const API_BASE_URL = "https://ricehub-umfd.onrender.com";
import { API_URL, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../utils/constants";

// Render / Live API Endpoint Fallback Base Axios Client
const configuredApiUrl =
  import.meta.env.VITE_API_URL ||
  API_URL ||
  "https://ricehub-umfd.onrender.com/api";
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, "");
const BASE_URL = /\/api$/i.test(normalizedApiUrl)
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

const isLoginRequest = (config) =>
  /(?:^|\/)(?:token|login)\/?$/.test(config.url || "");

// Request Interceptor: Attach Access Token on every outgoing request
api.interceptors.request.use(
  (config) => {
    const key = rateLimitKey(config);
    const cooldown = rateLimitCooldowns.get(key);
    if (cooldown && cooldown.until > Date.now()) {
      const delayMs = cooldown.until - Date.now();
      const error = new Error(rateLimitMessage(delayMs));
      error.retryAfterMs = delayMs;
      error.isRateLimitError = true;
      return Promise.reject(error);
    }

    const token =
      localStorage.getItem(ACCESS_TOKEN_KEY) ||
      localStorage.getItem("access_token");

    if (token && !isLoginRequest(config)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let waitingRequests = [];
let tokenRefreshPromise = null;
const rateLimitCooldowns = new Map();
const rateLimitAttempts = new Map();

function rateLimitKey(config) {
  return `${(config.method || "get").toLowerCase()}:${config.url || ""}`;
}

function rateLimitMessage(delayMs) {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return `You're refreshing too fast. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and tap Try again.`;
}

function retryAfterMilliseconds(header) {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export function refreshAccessToken() {
  if (!tokenRefreshPromise) {
    const refreshToken =
      localStorage.getItem(REFRESH_TOKEN_KEY) ||
      localStorage.getItem("refresh_token");

    if (!refreshToken) {
      return Promise.reject(new Error("No refresh token available"));
    }

    tokenRefreshPromise = axios
      .post(`${BASE_URL}/auth/refresh/`, { refresh: refreshToken })
      .then((response) => {
        const newAccessToken = response.data?.access;
        if (!newAccessToken) {
          throw new Error("The token refresh response did not include an access token.");
        }

        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        localStorage.setItem("access_token", newAccessToken);
        if (response.data.refresh) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh);
          localStorage.setItem("refresh_token", response.data.refresh);
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("token-refreshed"));
        }
        return newAccessToken;
      })
      .finally(() => {
        tokenRefreshPromise = null;
      });
  }

  return tokenRefreshPromise;
}

// Queue Processing Helper for Pending Demands
const processQueue = (error, token = null) => {
  waitingRequests.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });

  waitingRequests = [];
};

// Response Interceptor: Handle 401 Unauthorized & Smooth Token Refresh
api.interceptors.response.use(
  (response) => {
    const key = rateLimitKey(response.config || {});
    rateLimitCooldowns.delete(key);
    rateLimitAttempts.delete(key);
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    if (error.isRateLimitError) return Promise.reject(error);

    if (error.response?.status === 429) {
      const key = rateLimitKey(originalRequest || {});
      const attempts = (rateLimitAttempts.get(key) || 0) + 1;
      rateLimitAttempts.set(key, attempts);
      const exponentialDelay = Math.min(1000 * (2 ** (attempts - 1)), 60 * 1000);
      const serverDelay = retryAfterMilliseconds(error.response.headers?.["retry-after"]);
      const delayMs = Math.max(exponentialDelay, serverDelay);
      rateLimitCooldowns.set(key, { until: Date.now() + delayMs });
      error.retryAfterMs = delayMs;
      error.message = rateLimitMessage(delayMs);
      return Promise.reject(error);
    }

    if (isLoginRequest(originalRequest || {})) {
      return Promise.reject(error);
    }

    // Reject immediately if status is not 401 or request has already been retried
    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Queue requests if token refresh is already in progress
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitingRequests.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newAccessToken = await refreshAccessToken();

      // Process pending queued requests
      processQueue(null, newAccessToken);

      // Re-issue original failed request with fresh access token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      const refreshStatus = refreshError.response?.status;
      if (
        refreshStatus === 400
        || refreshStatus === 401
        || refreshError.message === "No refresh token available"
      ) {
        if (ACCESS_TOKEN_KEY) localStorage.removeItem(ACCESS_TOKEN_KEY);
        if (REFRESH_TOKEN_KEY) localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;