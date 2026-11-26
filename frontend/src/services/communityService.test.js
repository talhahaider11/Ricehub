import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import communityService from "./communityService";

vi.mock("./api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

describe("communityService events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts event data to the trailing-slash event endpoint", async () => {
    api.post.mockResolvedValue({ data: { id: 8 } });
    const data = {
      title: "Meetup",
      description: "Details",
      location: "Town Hall",
      starts_at: "2030-10-10T10:00:00.000Z",
      ends_at: null,
    };

    await expect(communityService.createEvent(data)).resolves.toEqual({ id: 8 });

    expect(api.post).toHaveBeenCalledWith(
      "/community/events/",
      data,
      undefined
    );
  });

  it("sends an event banner as multipart form data", async () => {
    api.post.mockResolvedValue({ data: { id: 9 } });
    const banner = new File(["banner"], "event.png", { type: "image/png" });
    const data = {
      title: "Meetup",
      description: "",
      location: "",
      starts_at: "2030-10-10T10:00:00.000Z",
      ends_at: null,
      banner,
    };

    await communityService.createEvent(data);

    const [url, payload, config] = api.post.mock.calls[0];
    expect(url).toBe("/community/events/");
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get("title")).toBe("Meetup");
    expect(payload.get("starts_at")).toBe(data.starts_at);
    expect(payload.get("banner")).toBe(banner);
    expect(payload.has("ends_at")).toBe(false);
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("loads the event interested-user list", async () => {
    api.get.mockResolvedValue({ data: [{ id: 3, username: "interested" }] });

    await expect(communityService.eventInterestedUsers(17)).resolves.toEqual([
      { id: 3, username: "interested" },
    ]);
    expect(api.get).toHaveBeenCalledWith(
      "/community/events/17/interested-users/"
    );
  });

  it("sends replacement event banners and listing images as multipart data", async () => {
    api.patch.mockResolvedValue({ data: {} });
    const banner = new File(["banner"], "event.png", { type: "image/png" });
    const image = new File(["image"], "item.png", { type: "image/png" });

    await communityService.updateEvent(17, { title: "Meetup", banner });
    await communityService.updateListing(23, { title: "Item", image });

    expect(api.patch).toHaveBeenNthCalledWith(
      1,
      "/community/events/17/",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    expect(api.patch.mock.calls[0][1].get("banner")).toBe(banner);
    expect(api.patch).toHaveBeenNthCalledWith(
      2,
      "/community/marketplace/23/",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    expect(api.patch.mock.calls[1][1].get("image")).toBe(image);
  });
});
