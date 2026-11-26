import { describe, expect, it } from "vitest";

import { API_URL, getMediaUrl } from "./constants";

describe("getMediaUrl", () => {
  it("keeps absolute Cloudflare media URLs unchanged", () => {
    const url = "https://pub-example.r2.dev/stories/example.webp";

    expect(getMediaUrl(url)).toBe(url);
  });

  it("resolves legacy relative media paths against the API host", () => {
    const apiHost = API_URL.replace(/\/api\/?$/, "");

    expect(getMediaUrl("/media/profile_pics/avatar.webp"))
      .toBe(`${apiHost}/media/profile_pics/avatar.webp`);
  });
});
