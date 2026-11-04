import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "../api";
import settingsService from "../settingsService";
import { REFRESH_TOKEN_KEY } from "../../utils/constants";

vi.mock("../api", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("settingsService session security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("sends the current refresh token when signing out other sessions", async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "current-refresh-token");
    api.post.mockResolvedValue({
      data: { detail: "Other sessions have been signed out." },
    });

    await expect(settingsService.signOutOtherSessions()).resolves.toEqual({
      detail: "Other sessions have been signed out.",
    });

    expect(api.post).toHaveBeenCalledWith(
      "/users/security/sessions/logout-all/",
      { refresh: "current-refresh-token" },
    );
  });
});
