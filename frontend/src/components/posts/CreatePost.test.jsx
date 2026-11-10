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
  default: () => null,
}));

vi.mock("../media/CameraCapture", () => ({
  default: function CameraCaptureMock({ onCapture, disabled }) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCapture(new File(["captured"], "camera.jpg", { type: "image/jpeg" }))}
      >
        Open camera
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

  it("adds a camera photo to the post submission", async () => {
    render(<CreatePost />);

    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(postService.create).toHaveBeenCalledOnce());
    const formData = postService.create.mock.calls[0][0];
    expect(formData.get("image")).toMatchObject({
      name: "camera.jpg",
      type: "image/jpeg",
    });
    expect(formData.get("post_type")).toBe("post");
  });
});
