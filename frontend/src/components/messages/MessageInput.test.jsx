import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MessageInput from "./MessageInput";

describe("MessageInput", () => {
  it("sends selected photo and video attachments with their media type", async () => {
    const onSendAttachment = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={vi.fn()} onSendAttachment={onSendAttachment} />);
    const file = new File(["photo"], "photo.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("Choose a photo or video"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(onSendAttachment).toHaveBeenCalledWith(file, undefined, "image");
    });
  });

  it("rejects files larger than the message attachment limit", async () => {
    const onSendAttachment = vi.fn();
    render(<MessageInput onSend={vi.fn()} onSendAttachment={onSendAttachment} />);
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "clip.mp4", {
      type: "video/mp4",
    });

    fireEvent.change(screen.getByLabelText("Choose a photo or video"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Photos and videos must be 10 MB or smaller."
    );
    expect(onSendAttachment).not.toHaveBeenCalled();
  });
});
