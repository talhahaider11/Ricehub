import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessageActions from "./MessageActions";

const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, "share");

describe("MessageActions", () => {
  const message = { id: 12, content: "Hello" };

  afterEach(() => {
    if (shareDescriptor) {
      Object.defineProperty(navigator, "share", shareDescriptor);
    } else {
      delete navigator.share;
    }
  });

  it("keeps Reply separate and shows Share in the three-dot menu", () => {
    const onReply = vi.fn();

    render(
      <MessageActions
        message={message}
        own={false}
        onReply={onReply}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledWith(message);
    fireEvent.click(screen.getByRole("button", { name: "Message options" }));
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("edits and deletes an owned message from the menu", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <MessageActions
        message={message}
        own
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole("button", { name: "Message options" }))
      .toBeInTheDocument();
    rerender(
      <MessageActions
        message={message}
        own
        open={false}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    rerender(
      <MessageActions
        message={message}
        own
        open
        onClose={vi.fn()}
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message" }), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(message, "Updated");
    });
    rerender(
      <MessageActions
        message={message}
        own
        open={false}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    rerender(
      <MessageActions
        message={message}
        own
        open
        onClose={vi.fn()}
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(message);
    });
  });

  it("shares an image or video attachment from the adjacent quick action", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    const attachmentMessage = {
      id: 22,
      content: "",
      attachment: "https://example.test/media/clip.mp4",
      attachment_type: "video",
    };
    const { container } = render(
      <MessageActions
        message={attachmentMessage}
        own
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(shareButton.parentElement).toBe(container.querySelector(".message-actions"));
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        text: "",
        url: attachmentMessage.attachment,
      });
    });
  });
});
