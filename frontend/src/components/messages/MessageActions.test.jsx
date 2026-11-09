import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MessageActions from "./MessageActions";

describe("MessageActions", () => {
  const message = { id: 12, content: "Hello" };

  it("keeps actions in a three-dot menu and replies from the menu", () => {
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

    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Message options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reply" }));

    expect(onReply).toHaveBeenCalledWith(message);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("edits and deletes an owned message from the menu", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <MessageActions
        message={message}
        own
        onReply={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Message options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message" }), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledWith(message, "Updated");
    });
    fireEvent.click(screen.getByRole("button", { name: "Message options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(message);
    });
  });
});
