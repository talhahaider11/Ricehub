import { describe, expect, it } from "vitest";
import api from "./api";

describe("API URL construction", () => {
  it("uses the Render API base and joins auth routes without duplicate or missing slashes", () => {
    expect(api.defaults.baseURL).toBe("https://ricehub-umfd.onrender.com/api");
    expect(api.getUri({ url: "/users/register/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/users/register/"
    );
    expect(api.getUri({ url: "/token/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/token/"
    );
    expect(api.getUri({ url: "/users/username-availability/" })).toBe(
      "https://ricehub-umfd.onrender.com/api/users/username-availability/"
    );
  });
});
