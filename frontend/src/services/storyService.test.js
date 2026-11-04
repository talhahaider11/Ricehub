import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import storyService from "./storyService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("storyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists stories and optionally filters by author", async () => {
    api.get.mockResolvedValue({ data: { results: [] } });

    await storyService.list();
    await storyService.list(17);

    expect(api.get).toHaveBeenNthCalledWith(1, "/stories/", {
      params: undefined,
    });
    expect(api.get).toHaveBeenNthCalledWith(2, "/stories/", {
      params: { author: 17 },
    });
  });

  it("creates stories with a ready media asset and visibility", async () => {
    api.post.mockResolvedValue({ data: { id: 7 } });

    await expect(
      storyService.createStory(12, "public", "A caption")
    ).resolves.toEqual({ id: 7 });

    expect(api.post).toHaveBeenCalledWith("/stories/create/", {
      media_id: 12,
      visibility: "public",
      caption: "A caption",
    });
  });

  it("supports text-only stories without a media ID", async () => {
    api.post.mockResolvedValue({ data: { id: 8 } });

    await storyService.createStory(null, "friends", "Text only");

    expect(api.post).toHaveBeenCalledWith("/stories/create/", {
      visibility: "friends",
      caption: "Text only",
    });
  });

  it("exposes view, delete and viewers endpoints", async () => {
    api.post.mockResolvedValue({ data: { message: "Story marked as viewed." } });
    api.get.mockResolvedValue({ data: { results: [] } });
    api.delete.mockResolvedValue({ status: 204 });

    await storyService.markViewed(9);
    await storyService.viewers(9);
    await storyService.remove(9);

    expect(api.post).toHaveBeenCalledWith("/stories/9/view/");
    expect(api.get).toHaveBeenCalledWith("/stories/9/viewers/");
    expect(api.delete).toHaveBeenCalledWith("/stories/9/delete/");
  });
});
