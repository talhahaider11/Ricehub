import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import postService from "../../services/postService";
import CommentBox from "./CommentBox";
import CommentList from "./CommentList";

vi.mock("../../services/postService", () => ({
  default: {
    comments: vi.fn(),
    createComment: vi.fn(),
  },
}));

describe("Comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the author returned by the comments API", async () => {
    postService.comments.mockResolvedValue({
      results: [
        {
          id: 8,
          author: { username: "comment-author" },
          content: "Visible comment",
        },
      ],
    });

    render(<CommentList postId={3} />);

    expect(await screen.findByText("comment-author")).toBeInTheDocument();
    expect(screen.getByText("Visible comment")).toBeInTheDocument();
  });

  it("submits a comment and notifies the post to refresh its list", async () => {
    const onCreated = vi.fn();
    const comment = {
      id: 9,
      author: { username: "comment-author" },
      content: "New comment",
    };
    postService.createComment.mockResolvedValue(comment);

    render(<CommentBox postId={3} onCreated={onCreated} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Comment content" }), {
      target: { value: "  New comment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(postService.createComment).toHaveBeenCalledWith(3, "New comment");
    });
    expect(onCreated).toHaveBeenCalledWith(comment);
  });
});
