import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessageList from "./MessageList";

describe("MessageList", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows actions for the user's message after a two-second hold", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MessageList
        messages={[
          {
            id: 1,
            content: "My message",
            sender: { id: 7 },
            is_read: false,
          },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const message = screen.getByText("My message").closest(".message");
    fireEvent.pointerDown(message);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message options" }))
      .not.toBeInTheDocument();
  });

  it("shows a single sent or seen receipt for the latest own message", () => {
    render(
      <MessageList
        messages={[
          { id: 1, content: "First", sender: { id: 7 }, is_read: false },
          { id: 2, content: "Second", sender: { id: 7 }, is_read: true },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Seen")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).not.toBeInTheDocument();
  });
});
