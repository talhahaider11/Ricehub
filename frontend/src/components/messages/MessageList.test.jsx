import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessageList from "./MessageList";

describe("MessageList", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the requested actions for the user's message after a two-second hold", () => {
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

    const bubble = screen.getByText("My message").closest(".message-bubble");
    fireEvent.pointerDown(bubble, { pointerType: "touch" });

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Unsend" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("shows Share for an incoming message after a hold and preserves Reply separately", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MessageList
        messages={[
          {
            id: 2,
            content: "Their message",
            sender: { id: 8 },
          },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.pointerDown(
      screen.getByText("Their message").closest(".message-bubble"),
      { pointerType: "touch" }
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Unsend" })).not.toBeInTheDocument();
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

  it("hides the previous Sent or Seen receipt as soon as the other person replies", () => {
    render(
      <MessageList
        messages={[
          { id: 1, content: "My message", sender: { id: 7 }, is_read: true },
          { id: 2, content: "Their reply", sender: { id: 8 }, is_read: false },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText("Seen")).not.toBeInTheDocument();
    expect(screen.queryByText("Sent")).not.toBeInTheDocument();
  });

  it("shows the profile hero and places the trust warning beneath its profile link", () => {
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MemoryRouter>
        <MessageList
          messages={[]}
          currentUser={{ id: 7 }}
          onReply={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          conversationPartner={{
            id: 8,
            username: "friend",
            first_name: "New",
            last_name: "Friend",
          }}
          showVerificationWarning
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "New Friend" })).toBeInTheDocument();
    const profileLink = screen.getByRole("link", { name: "View profile" });
    expect(profileLink).toHaveAttribute("href", "/profile/8");
    expect(profileLink.compareDocumentPosition(screen.getByRole("alert")) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
