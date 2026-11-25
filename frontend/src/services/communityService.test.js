import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import communityService from "./communityService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("communityService comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every page of community post comments", async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          results: [{ id: 1 }],
          next: "https://api.example.test/api/community/community-posts/9/comments/?page=2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [{ id: 2 }],
          next: null,
        },
      });

    await expect(communityService.communityPostComments(9)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/community/community-posts/9/comments/"
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/community/community-posts/9/comments/?page=2"
    );
  });
});
