import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MessageShareModal from "./MessageShareModal";

const currentUser = { id: 1 };
const message = {
  id: 14,
  content: "A useful update",
  attachment: "https://example.test/photo.jpg",
  attachment_type: "image",
};
const conversations = [
  {
    id: 20,
    is_group: false,
    participants: [
      currentUser,
      { id: 2, first_name: "Verified", last_name: "Friend", is_verified: true },
    ],
  },
  {
    id: 21,
    is_group: true,
    name: "Study group",
    participants: [currentUser, { id: 3, username: "member" }],
  },
];

describe("MessageShareModal", () => {
  it("searches all chat types and shows sent feedback after forwarding", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageShareModal
        open
        onClose={vi.fn()}
        message={message}
        conversations={conversations}
        currentUser={currentUser}
        onSend={onSend}
      />
    );

    expect(screen.getByText("Study group")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified account")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search conversations" }), {
      target: { value: "study" },
    });
    expect(screen.getByText("Study group")).toBeInTheDocument();
    expect(screen.queryByText("Verified Friend")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send to Study group" }));
    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith(conversations[1], message);
      expect(screen.getByRole("button", { name: "Sent to Study group" }))
        .toHaveTextContent("Sent ✓");
    });
  });

  it("shows a forwarding error and allows retrying that conversation", async () => {
    const onSend = vi.fn()
      .mockRejectedValueOnce(new Error("Chat is unavailable."))
      .mockResolvedValueOnce(undefined);
    render(
      <MessageShareModal
        open
        onClose={vi.fn()}
        message={message}
        conversations={[conversations[0]]}
        currentUser={currentUser}
        onSend={onSend}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send to Verified Friend" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chat is unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Send to Verified Friend" }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Sent to Verified Friend" }))
        .toBeDisabled();
    });
  });
});
