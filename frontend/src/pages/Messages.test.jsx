import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Messages from "./Messages";

const mocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  createConversation: vi.fn(),
  friends: vi.fn(),
  useMessages: vi.fn(),
}));

vi.mock("../services/messageService", () => ({
  default: {
    conversations: mocks.conversations,
    createConversation: mocks.createConversation,
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
  default: () => ({ user: { id: 1, username: "me", is_email_verified: true } }),
}));

vi.mock("../hooks/useMessages", () => ({
  default: mocks.useMessages,
}));

vi.mock("../components/messages/MessageList", () => ({
  default: () => <div data-testid="message-list" />,
}));

vi.mock("../components/messages/MessageInput", () => ({
  default: () => <div data-testid="message-input" />,
}));

vi.mock("../components/messages/AudioCallControls", () => ({
  default: () => <button type="button" aria-label="Start audio call" />,
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
    mocks.conversations.mockResolvedValue([
      {
        id: 4,
        is_group: false,
        conversation_type: "direct",
        participants: [
          { id: 1, username: "me" },
          { id: 2, username: "talha2", is_online: true },
        ],
      },
    ]);
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

    fireEvent.click(await screen.findByRole("button", { name: /talha2/ }));

    await waitFor(() => {
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });
    expect(screen.getAllByText("talha2")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Start audio call" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to conversations" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Messages" }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to conversations" }));
    expect(await screen.findByRole("heading", { name: "Messages" }))
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
});
