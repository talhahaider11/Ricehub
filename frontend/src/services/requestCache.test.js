import { describe, expect, it, vi } from "vitest";
import { cachedRequest } from "./requestCache";

describe("cachedRequest", () => {
  it("deduplicates in-flight reads and reuses their result for 90 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const request = vi.fn().mockResolvedValue({ items: [1] });

    try {
      const first = cachedRequest("test:feed", request);
      const duplicate = cachedRequest("test:feed", request);
      expect(await first).toEqual({ items: [1] });
      expect(await duplicate).toEqual({ items: [1] });
      expect(request).toHaveBeenCalledOnce();

      expect(await cachedRequest("test:feed", request)).toEqual({ items: [1] });
      expect(request).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(90_001);
      await cachedRequest("test:feed", request);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
