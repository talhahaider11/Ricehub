import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import postService from "../../services/postService";
import PostCard from "./PostCard";

vi.mock("../../services/postService", () => ({
  default: {
    react: vi.fn(),
    unreact: vi.fn(),
  },
}));

vi.mock("../common/Avatar", () => ({ default: () => null }));
vi.mock("./CommentBox", () => ({ default: () => null }));
vi.mock("./CommentList", () => ({ default: () => null }));
vi.mock("./PostMenu", () => ({ default: () => null }));
vi.mock("../common/ImageLightbox", () => ({ default: () => null }));
vi.mock("./PostContent", () => ({ default: ({ content }) => <p>{content}</p> }));

const post = {
  id: 17,
  author: { username: "alice", first_name: "Alice" },
  content: "Hello RiceHub!",
  my_reaction: "love",
  reactions_count: 3,
  comments_count: 2,
};

describe("PostCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows accurate reaction and comment counts", () => {
    render(<PostCard post={post} currentUser={{ id: 1 }} />);

    expect(screen.getByText("3 reactions")).toBeInTheDocument();
    expect(screen.getByText("2 comments")).toBeInTheDocument();
    expect(screen.getByText("Hello RiceHub!")).toBeInTheDocument();
  });

  it("sends the selected reaction type to the API", () => {
    postService.react.mockResolvedValue({});
    render(<PostCard post={post} currentUser={{ id: 1 }} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose a reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Haha" }));

    return waitFor(() => {
      expect(postService.react).toHaveBeenCalledWith(17, "haha");
    });
  });
});
