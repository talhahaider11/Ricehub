import { describe, expect, it } from "vitest";
import { getArrayResults } from "./arrayResults";

describe("getArrayResults", () => {
  it("extracts a list from a paginated response", () => {
    const posts = [{ id: 1 }, { id: 2 }];

    expect(
      getArrayResults({ count: 2, next: null, previous: null, results: posts }, "Posts")
    ).toBe(posts);
  });

  it("surfaces API authentication errors instead of reporting a bad list", () => {
    expect(() =>
      getArrayResults(
        { detail: "Authentication credentials were not provided." },
        "Posts"
      )
    ).toThrow("Authentication credentials were not provided.");
  });

  it("rejects malformed success responses", () => {
    expect(() => getArrayResults({ unexpected: true }, "Posts")).toThrow(
      "Posts response did not contain a list."
    );
  });
});
