import axios from "axios";
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
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

const isLoginRequest = (config) =>
  /(?:^|\/)(?:token|login)\/?$/.test(config.url || "");

// Request Interceptor: Attach Access Token on every outgoing request
api.interceptors.request.use(
  (config) => {
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
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

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
      const refreshToken =
        localStorage.getItem(REFRESH_TOKEN_KEY) ||
        localStorage.getItem("refresh_token");

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      // Separate axios instance call to prevent interceptor loop
      const response = await axios.post(`${BASE_URL}/auth/refresh/`, {
        refresh: refreshToken,
      });

      const newAccessToken = response.data.access;

      // Store updated token in localStorage
      if (ACCESS_TOKEN_KEY) {
        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
      }
      localStorage.setItem("access_token", newAccessToken);

      // Process pending queued requests
      processQueue(null, newAccessToken);

      // Re-issue original failed request with fresh access token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Clear tokens and redirect user to login on auth failure
      if (ACCESS_TOKEN_KEY) localStorage.removeItem(ACCESS_TOKEN_KEY);
      if (REFRESH_TOKEN_KEY) localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;