import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import authService from "./authService";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../utils/constants";

vi.mock("./api", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("rejects a response without authentication tokens", async () => {
    api.post.mockResolvedValue({ data: {} });

    await expect(
      authService.login({ username: "test-user", password: "wrong-password" })
    ).rejects.toThrow("The server did not return valid authentication tokens.");
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("stores tokens returned by the backend", async () => {
    api.post.mockResolvedValue({
      data: { access: "valid-access", refresh: "valid-refresh" },
    });

    await authService.login({ username: "test-user", password: "correct-password" });

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("valid-access");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("valid-refresh");
  });
});

describe("authService.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a frontend HTML response instead of reporting a created account", async () => {
    api.post.mockResolvedValue({
      status: 200,
      data: "<!doctype html><html></html>",
    });

    await expect(
      authService.register({
        username: "test-user",
        email: "test@example.com",
        password: "StrongPassword123!",
      })
    ).rejects.toThrow("The server returned an invalid registration response.");
  });

  it("accepts a successful backend registration response", async () => {
    const response = {
      status: 201,
      data: { message: "Registration successful." },
    };
    api.post.mockResolvedValue(response);

    await expect(
      authService.register({
        username: "test-user",
        email: "test@example.com",
        password: "StrongPassword123!",
      })
    ).resolves.toBe(response);
  });
});
