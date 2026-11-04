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
});
