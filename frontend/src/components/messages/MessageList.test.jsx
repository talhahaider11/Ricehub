import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessageList from "./MessageList";

function firePointerEvent(element, type, properties) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  fireEvent(element, event);
}

function fireTouchEvent(element, type, x, y) {
  const touch = { clientX: x, clientY: y };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [touch],
  });
  Object.defineProperty(event, "changedTouches", { value: [touch] });
  fireEvent(element, event);
}

describe("MessageList", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the requested actions in the mobile menu after a 0.5-second touch hold", () => {
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
      vi.advanceTimersByTime(1499);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
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
      vi.advanceTimersByTime(1000);
    });
    fireEvent.touchEnd(bubble);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("cancels the action menu when a touch moves like a scroll", () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <MessageList
        messages={[{ id: 1, content: "My message", sender: { id: 7 } }]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const bubble = screen.getByText("My message").closest(".message-bubble");
    firePointerEvent(bubble, "pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    firePointerEvent(bubble, "pointermove", {
      pointerType: "touch",
      pointerId: 1,
      clientX: 100,
      clientY: 120,
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("replies to image, video, and audio messages on a left swipe", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onReply = vi.fn();
    const messages = [
      {
        id: 1,
        sender: { id: 8 },
        attachment: "/media/photo.jpg",
        attachment_type: "image",
      },
      {
        id: 2,
        sender: { id: 8 },
        attachment: "/media/clip.mp4",
        attachment_type: "video",
      },
      {
        id: 3,
        sender: { id: 8 },
        attachment: "/media/voice.webm",
        attachment_type: "audio",
      },
    ];
    const { container } = render(
      <MessageList
        messages={messages}
        currentUser={{ id: 7 }}
        onReply={onReply}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    [
      container.querySelector(".message-image-attachment"),
      container.querySelector(".message-video-attachment"),
      container.querySelector(".message-bubble audio"),
    ].forEach((attachment, index) => {
      fireTouchEvent(attachment, "touchstart", 180, 100);
      fireTouchEvent(attachment, "touchmove", 90, 104);
      fireTouchEvent(attachment, "touchend", 90, 104);
      expect(onReply).toHaveBeenNthCalledWith(index + 1, messages[index]);
    });
  });

  it("does not reply to a rightward swipe", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onReply = vi.fn();
    const { container } = render(
      <MessageList
        messages={[{ id: 1, content: "Message", sender: { id: 8 } }]}
        currentUser={{ id: 7 }}
        onReply={onReply}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const bubble = container.querySelector(".message-bubble");

    fireTouchEvent(bubble, "touchstart", 90, 100);
    fireTouchEvent(bubble, "touchmove", 180, 104);
    fireTouchEvent(bubble, "touchend", 180, 104);

    expect(onReply).not.toHaveBeenCalled();
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

    firePointerEvent(
      screen.getByText("Their message").closest(".message-bubble"),
      "pointerdown",
      { pointerType: "touch", pointerId: 1 }
    );
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Seen").closest(".message-bubble")).toBeInTheDocument();
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

  it("shows a corner upload indicator inside an optimistic video bubble", () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            id: "local-video-1",
            sender: { id: 7 },
            attachment: "blob:local-video",
            attachment_type: "video",
            upload_status: "uploading",
            created_at: "2026-11-17T10:00:00Z",
          },
        ]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const bubble = container.querySelector(".message-bubble");

    expect(bubble.querySelector(".message-video-upload-indicator"))
      .toHaveAttribute("role", "status");
    expect(bubble.querySelector(".message-video-upload-indicator"))
      .toHaveAccessibleName("Sending...");
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

  it("keeps image timestamps and receipts in the media overlay", () => {
    Element.prototype.scrollIntoView = vi.fn();

    const { container } = render(
      <MessageList
        messages={[{
          id: 5,
          sender: { id: 7 },
          attachment: "/media/photo.jpg",
          attachment_type: "image",
          created_at: "2026-11-15T10:01:00Z",
          is_read: false,
        }]}
        currentUser={{ id: 7 }}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const metadata = container.querySelector(".message-media-meta");
    expect(metadata).toContainElement(container.querySelector(".message-time"));
    expect(metadata).toContainElement(container.querySelector(".message-receipt"));
    expect(container.querySelector(".message-bubble--media"))
      .toContainElement(metadata);
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

  it("renders a completed voice call with its duration and timestamp", () => {
    render(
      <MessageList
        messages={[{
          id: 4,
          sender: { id: 7 },
          message_type: "call_log",
          call_id: "call-4",
          call_status: "completed",
          call_duration_seconds: 135,
          created_at: "2025-01-10T12:52:00Z",
        }]}
        currentUser={{ id: 7 }}
      />
    );

    expect(screen.getByText("Voice call")).toBeInTheDocument();
    expect(screen.getByText("2 min 15 sec")).toBeInTheDocument();
    expect(screen.getByText("Voice call").closest(".message-bubble"))
      .toHaveClass("message-bubble--call-log");
    expect(screen.getByText("Voice call").closest(".message-call-card"))
      .toContainElement(screen.getByText("2 min 15 sec"));
  });

  it("lets the recipient call back from a missed voice call card", () => {
    const onCallBack = vi.fn();
    const message = {
      id: 5,
      sender: { id: 8 },
      message_type: "call_log",
      call_id: "call-5",
      call_status: "unanswered",
      created_at: "2025-01-10T12:52:00Z",
    };

    render(
      <MessageList
        messages={[message]}
        currentUser={{ id: 7 }}
        onCallBack={onCallBack}
      />
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Missed voice call. Tap to call back",
    }));

    expect(onCallBack).toHaveBeenCalledWith(message);
    expect(screen.getByText("Tap to call back")).toBeInTheDocument();
  });
});
