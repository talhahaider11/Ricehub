import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Messages from "./Messages";

const mocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  createConversation: vi.fn(),
  friends: vi.fn(),
  useMessages: vi.fn(),
  sendText: vi.fn(),
  archiveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  startCall: vi.fn(),
}));

vi.mock("../services/messageService", () => ({
  default: {
    conversations: mocks.conversations,
    createConversation: mocks.createConversation,
    archiveConversation: mocks.archiveConversation,
    deleteConversation: mocks.deleteConversation,
    sendText: mocks.sendText,
    sendAttachment: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));

vi.mock("../services/friendService", () => ({
  default: {
    list: mocks.friends,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => ({
    user: {
      id: 1,
      username: "me",
      is_email_verified: true,
      is_verified: true,
    },
  }),
}));

vi.mock("../hooks/useMessages", () => ({
  default: mocks.useMessages,
}));

vi.mock("../context/CallContext", () => ({
  useCall: () => ({ startCall: mocks.startCall }),
}));

vi.mock("../context/ChatUploadContext", () => ({
  useChatUploads: () => ({
    uploads: [],
    queueVideoUpload: vi.fn(),
  }),
}));

vi.mock("../components/messages/MessageList", () => ({
  default: ({ showVerificationWarning, onShare }) => (
    <div data-testid="message-list">
      {onShare && (
        <button
          type="button"
          onClick={() => onShare({
            id: 99,
            content: "Check this",
            attachment: "https://example.test/media/photo.jpg",
          })}
        >
          Open share modal
        </button>
      )}
      {showVerificationWarning && (
        <p role="alert">
          ⚠️ This user is unverified. Trust this person at your own risk.
        </p>
      )}
    </div>
  ),
}));

vi.mock("../components/messages/MessageInput", () => ({
  default: () => <div data-testid="message-input" />,
}));

vi.mock("../components/messages/AudioCallControls", () => ({
  default: () => <button type="button" aria-label="Start audio call" />,
  AudioCallButtons: () => <button type="button" aria-label="Start audio call" />,
}));

vi.mock("../components/messages/TypingIndicator", () => ({
  default: () => null,
}));

vi.mock("../components/messages/CreateGroupModal", () => ({
  default: () => null,
}));

describe("Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.friends.mockResolvedValue([]);
    mocks.conversations.mockImplementation((params = {}) => Promise.resolve(
      params.archived ? [] : [
        {
          id: 4,
          is_group: false,
          conversation_type: "direct",
          participants: [
            { id: 1, username: "me" },
            { id: 2, username: "talha2", is_online: true, is_verified: true },
          ],
        },
      ]
    ));
    mocks.useMessages.mockReturnValue({
      messages: [],
      setMessages: vi.fn(),
      connected: true,
      typingUser: false,
      error: "",
      sendMessage: vi.fn(),
      sendTyping: vi.fn(),
      sendCallSignal: vi.fn(),
      callSignal: null,
      clearCallSignal: vi.fn(),
    });
  });

  it("shows only the selected chat and keeps call controls in its header", async () => {
    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Chats" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New message" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search conversations" }))
      .toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", {
      name: "Open conversation with talha2",
    }));

    await waitFor(() => {
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });
    expect(screen.getAllByText("talha2")).toHaveLength(1);
    expect(screen.getByText("Active now")).toBeInTheDocument();
    expect(document.querySelector(".chat-presence-dot")).toBeNull();
    expect(document.querySelector(".chat-header-online-dot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start audio call" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to conversations" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View talha2's profile" }))
      .toHaveAttribute("href", "/profile/2");
    expect(screen.queryByRole("heading", { name: "Messages" }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to conversations" }));
    expect(await screen.findByRole("heading", { name: "Chats" }))
      .toBeInTheDocument();
    expect(screen.queryByTestId("message-list")).not.toBeInTheDocument();
  });

  it("opens a new conversation with an online friend who has no chat yet", async () => {
    mocks.friends.mockResolvedValue([
      { id: 8, username: "friend-only", is_online: true },
    ]);
    mocks.createConversation.mockResolvedValue({
      id: 9,
      is_group: false,
      conversation_type: "direct",
      other_user: { id: 8, username: "friend-only", is_online: true },
    });

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "Start chat with friend-only",
    }));

    await waitFor(() => {
      expect(mocks.createConversation).toHaveBeenCalledWith("friend-only");
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });
  });

  it("shows a warning banner for an unverified direct-message partner", async () => {
    mocks.conversations.mockResolvedValue([
      {
        id: 12,
        is_group: false,
        conversation_type: "direct",
        participants: [
          { id: 1, username: "me", is_verified: true },
          { id: 2, username: "unverified-person", is_verified: false },
        ],
      },
    ]);

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "Open conversation with unverified-person",
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "⚠️ This user is unverified. Trust this person at your own risk."
    );
  });

  it("does not show the direct-message warning in a group conversation", async () => {
    mocks.conversations.mockResolvedValue([
      {
        id: 13,
        is_group: true,
        conversation_type: "group",
        name: "Group",
        participants: [
          { id: 1, username: "me", is_verified: true },
          { id: 2, username: "unverified-person", is_verified: false },
        ],
      },
    ]);

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "Open conversation with Group",
    }));

    expect(await screen.findByTestId("message-list")).toBeInTheDocument();
    expect(screen.queryByText(/This user is unverified/)).not.toBeInTheDocument();
    expect(document.querySelector(".chat-header-profile-link")).toBeNull();
  });

  it("opens archived chats separately from the inbox", async () => {
    mocks.conversations.mockImplementation((params = {}) => Promise.resolve(
      params.archived
        ? [{
          id: 22,
          is_archived: true,
          is_group: false,
          conversation_type: "direct",
          participants: [
            { id: 1, username: "me" },
            { id: 9, username: "archived-friend" },
          ],
        }]
        : []
    ));

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Archived/ }));

    expect(await screen.findByRole("heading", { name: "Archived" }))
      .toBeInTheDocument();
    expect(await screen.findByRole("button", {
      name: "Open conversation with archived-friend",
    })).toBeInTheDocument();
  });

  it("forwards the message text and media URL through the existing send API", async () => {
    mocks.conversations.mockImplementation((params = {}) => Promise.resolve(
      params.archived ? [] : [
        {
          id: 4,
          is_group: false,
          conversation_type: "direct",
          participants: [
            { id: 1, username: "me" },
            { id: 2, username: "talha2" },
          ],
        },
        {
          id: 5,
          is_group: true,
          conversation_type: "group",
          name: "Target group",
          participants: [
            { id: 1, username: "me" },
            { id: 3, username: "member" },
          ],
        },
      ]
    ));
    mocks.sendText.mockResolvedValue({
      id: 100,
      content: "Check this\nhttps://example.test/media/photo.jpg",
      created_at: "2026-11-17T10:00:00Z",
    });

    render(
      <MemoryRouter>
        <Messages />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole("button", {
      name: "Open conversation with talha2",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Open share modal" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to Target group" }));

    await waitFor(() => {
      expect(mocks.sendText).toHaveBeenCalledWith(
        5,
        "Check this\nhttps://example.test/media/photo.jpg"
      );
      expect(screen.getByRole("button", { name: "Sent to Target group" }))
        .toHaveTextContent("Sent ✓");
    });
  });
});
