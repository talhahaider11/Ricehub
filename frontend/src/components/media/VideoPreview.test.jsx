import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoPreview from "./VideoPreview";

describe("VideoPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses a managed blob URL and revokes it on unmount", () => {
    const file = new File(["video"], "recording.mp4", { type: "video/mp4" });
    const load = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});
    const createObjectURL = vi.fn().mockReturnValue("blob:recorded-video");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const { container, unmount } = render(<VideoPreview file={file} />);
    const video = container.querySelector("video");

    expect(video).toHaveAttribute("src", "blob:recorded-video");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("webkit-playsinline", "true");
    expect(video).toHaveAttribute("preload", "auto");
    expect(load).toHaveBeenCalled();

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:recorded-video");
  });
});
