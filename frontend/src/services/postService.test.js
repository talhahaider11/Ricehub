import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import postService from "./postService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("postService personalized feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a paginated For You feed", async () => {
    api.get.mockResolvedValue({ data: { results: [] } });

    await postService.list(2, "for_you");

    expect(api.get).toHaveBeenCalledWith("/feed/", {
      params: { page: 2 },
    });
  });

  it("records a feed post view", async () => {
    api.post.mockResolvedValue({ data: { success: true } });

    await postService.trackFeedView(42);

    expect(api.post).toHaveBeenCalledWith("/feed/42/view/");
  });

  it("loads every page of comments before returning", async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          results: [{ id: 1 }],
          next: "https://api.example.test/api/posts/17/comments/?page=2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          results: [{ id: 2 }],
          next: null,
        },
      });

    await expect(postService.comments(17)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(api.get).toHaveBeenNthCalledWith(1, "/posts/17/comments/");
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/posts/17/comments/?page=2"
    );
  });
});
