import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreatePost from "./CreatePost";
import postService from "../../services/postService";

vi.mock("../../services/postService", () => ({
  default: { create: vi.fn() },
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { username: "test-user" } }),
}));

vi.mock("../common/Avatar", () => ({
  default: () => <div aria-hidden="true" />,
}));

vi.mock("../media/MediaUploader", () => ({
  default: function MediaUploaderMock({ onUploaded }) {
    return (
      <button
        type="button"
        onClick={() => onUploaded([{
          id: 21,
          media_type: "image",
          original_filename: "camera.jpg",
          url: "/camera.jpg",
        }])}
      >
        Add captured photo
      </button>
    );
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreatePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:camera-preview"),
    });
    postService.create.mockResolvedValue({ id: 12 });
  });

  it("adds uploaded camera media to the post submission", async () => {
    render(<CreatePost />);

    fireEvent.click(screen.getByRole("button", { name: "Add captured photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(postService.create).toHaveBeenCalledOnce());
    const formData = postService.create.mock.calls[0][0];
    expect(formData.get("media_ids")).toBe("21");
    expect(formData.get("post_type")).toBe("post");
  });
});
