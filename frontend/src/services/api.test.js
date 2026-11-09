import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../utils/constants";

describe("API URL construction", () => {
  it("uses the Render API base and joins auth routes without duplicate or missing slashes", () => {
    expect(api.defaults.baseURL).toBe("https://ricehub-umfd.onrender.com/api");
    expect(api.defaults.timeout).toBe(60000);
    expect(api.getUri({ url: "/users/register/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/users/register/"
    );
    expect(api.getUri({ url: "/token/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/token/"
    );
    expect(api.getUri({ url: "/users/username-availability/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/users/username-availability/"
    );
  });
});

describe("API token refresh", () => {
  let originalAdapter;
  const responseInterceptor = api.interceptors.response.handlers[0].rejected;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access");
    localStorage.setItem(REFRESH_TOKEN_KEY, "current-refresh");
    originalAdapter = api.defaults.adapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it("persists both tokens when the backend rotates the refresh token", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        access: "new-access",
        refresh: "rotated-refresh",
      },
    });
    api.defaults.adapter = vi.fn(async (config) => ({
      config,
      data: { ok: true },
      headers: {},
      status: 200,
      statusText: "OK",
    }));

    const response = await responseInterceptor({
      config: { url: "/users/me/", headers: {} },
      response: { status: 401 },
    });

    expect(response.data).toEqual({ ok: true });
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("new-access");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("rotated-refresh");
    expect(localStorage.getItem("refresh_token")).toBe("rotated-refresh");
  });

  it("keeps tokens when refresh fails because the network is unavailable", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Network unavailable"));

    await expect(
      responseInterceptor({
        config: { url: "/users/me/", headers: {} },
        response: { status: 401 },
      })
    ).rejects.toThrow("Network unavailable");

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("expired-access");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("current-refresh");
  });
});
