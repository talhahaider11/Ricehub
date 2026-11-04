import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api";
import notificationService from "../notificationService";

vi.mock("../api", () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("notificationService device endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a device token and platform with the backend", async () => {
    const response = { data: { token: "native-token", platform: "android" } };
    api.post.mockResolvedValue(response);

    await expect(
      notificationService.registerDevice("native-token", "android")
    ).resolves.toEqual(response.data);

    expect(api.post).toHaveBeenCalledWith("/notifications/devices/", {
      token: "native-token",
      platform: "android",
    });
  });

  it("unregisters the current user's device token", async () => {
    api.delete.mockResolvedValue({ status: 204 });

    await notificationService.unregisterDevice(
      "native-token",
      "session-access-token"
    );

    expect(api.delete).toHaveBeenCalledWith("/notifications/devices/", {
      data: { token: "native-token" },
      headers: { Authorization: "Bearer session-access-token" },
    });
  });
});
