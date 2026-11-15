import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "../utils/constants";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("./api", () => ({ default: apiMocks }));
vi.mock("./mediaService", () => ({
  prepareImage: vi.fn(async (file) => file),
}));

import messageService from "./messageService";

describe("messageService", () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    vi.stubGlobal("WebSocket", vi.fn());
  });

  it("connects to the backend chat WebSocket route", () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, "chat token");

    messageService.createSocket(42);

    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringMatching(/\/ws\/chat\/42\/\?token=chat%20token$/)
    );
  });

  it("sends text through the authenticated messages API", async () => {
    apiMocks.post.mockResolvedValue({ data: { id: 8, content: "Hello" } });

    await expect(messageService.sendText(42, "Hello", 5))
      .resolves.toEqual({ id: 8, content: "Hello" });

    expect(apiMocks.post).toHaveBeenCalledWith(
      "/messages/conversations/42/messages/",
      { content: "Hello", reply_to_id: 5 }
    );
  });

  it("sends attachment data without overriding the browser multipart boundary", async () => {
    apiMocks.post.mockResolvedValue({ data: { id: 9 } });
    const file = new File(["voice"], "voice-note.webm", { type: "audio/webm" });

    await messageService.sendAttachment(42, file, 5, "audio");

    const [url, formData, config] = apiMocks.post.mock.calls[0];
    expect(url).toBe("/messages/conversations/42/messages/");
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("attachment")).toMatchObject({
      name: "voice-note.webm",
      type: "audio/webm",
    });
    expect(formData.get("attachment_type")).toBe("audio");
    expect(formData.get("reply_to_id")).toBe("5");
    expect(config).toBeUndefined();
  });
});
