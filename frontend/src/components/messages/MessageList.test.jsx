import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessageList from "./MessageList";

describe("MessageList", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the requested actions in the mobile menu after a two-second touch hold", () => {
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
    fireEvent.touchStart(bubble);

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
    expect(screen.getByRole("menu").parentElement).toBe(document.body);
  });

  it("cancels the action menu when a touch is released before the hold threshold", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MessageList
        messages={[
          {
            id: 1,
            content: "My message",
            sender: { id: 7 },
          },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const bubble = screen.getByText("My message").closest(".message-bubble");
    fireEvent.touchStart(bubble);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.touchEnd(bubble);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
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

  it("renders image, video, and audio attachments in the conversation", () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            id: 1,
            content: "",
            sender: { id: 8 },
            attachment: "/media/photo.jpg",
            attachment_type: "image",
            created_at: "2026-11-15T10:00:00Z",
          },
          {
            id: 2,
            content: "",
            sender: { id: 8 },
            attachment: "/media/clip.mp4",
            attachment_type: "video",
            created_at: "2026-11-15T10:01:00Z",
          },
          {
            id: 3,
            content: "",
            sender: { id: 8 },
            attachment: "/media/voice.webm",
            attachment_type: "audio",
            created_at: "2026-11-15T10:02:00Z",
          },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(container.querySelector(".message-image-attachment"))
      .toHaveAttribute("src", "/media/photo.jpg");
    expect(container.querySelector(".message-video-attachment"))
      .toHaveAttribute("src", "/media/clip.mp4");
    expect(container.querySelector(".message-bubble audio"))
      .toHaveAttribute("src", "/media/voice.webm");
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
