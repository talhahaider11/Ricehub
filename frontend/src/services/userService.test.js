import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import userService from "./userService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("userService.checkUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid availability and suggestions from the backend", async () => {
    const data = {
      username: "new-user",
      available: false,
      suggestions: ["new-user1", "new-user2", "new-user3"],
    };
    api.get.mockResolvedValue({ data });

    await expect(userService.checkUsername("new-user")).resolves.toBe(data);
    expect(api.get).toHaveBeenCalledWith("/users/username-availability/", {
      params: { username: "new-user" },
    });
  });

  it("rejects a non-API response rather than falsely labeling a username taken", async () => {
    api.get.mockResolvedValue({
      data: "<!doctype html><html></html>",
    });

    await expect(userService.checkUsername("new-user")).rejects.toThrow(
      "The server returned an invalid username availability response."
    );
  });
});
