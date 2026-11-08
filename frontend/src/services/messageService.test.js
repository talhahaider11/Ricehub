import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "../utils/constants";
import messageService from "./messageService";

describe("messageService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("WebSocket", vi.fn());
  });

  it("connects to the backend chat WebSocket route", () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, "chat token");

    messageService.createSocket(42);

    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringMatching(/\/ws\/chat\/42\/\?token=chat%20token$/)
    );
  });
});
