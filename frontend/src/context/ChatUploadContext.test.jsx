import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChatUploads: vi.fn(),
  saveChatUpload: vi.fn(),
  removeChatUpload: vi.fn(),
  sendAttachment: vi.fn(),
}));

vi.mock("../services/chatUploadStore", () => ({
  getChatUploads: mocks.getChatUploads,
  saveChatUpload: mocks.saveChatUpload,
  removeChatUpload: mocks.removeChatUpload,
}));

vi.mock("../services/messageService", () => ({
  default: {
    sendAttachment: mocks.sendAttachment,
  },
}));

vi.mock("../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7 } }),
}));

import {
  ChatUploadProvider,
  useChatUploads,
} from "./ChatUploadContext";

function UploadProbe() {
  const { uploads, queueVideoUpload } = useChatUploads();
  return (
    <>
      <button
        type="button"
        onClick={() => void queueVideoUpload({
          conversationId: 42,
          file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
          replyToId: 5,
          attachmentType: "video",
        })}
      >
        Queue video
      </button>
      <output data-testid="upload-state">
        {uploads.map((upload) => `${upload.status}:${upload.fileName}`).join(",")}
      </output>
    </>
  );
}

describe("ChatUploadProvider", () => {
  beforeEach(() => {
    mocks.getChatUploads.mockResolvedValue([]);
    mocks.saveChatUpload.mockResolvedValue(undefined);
    mocks.removeChatUpload.mockResolvedValue(undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:queued-video"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps an optimistic video queued while uploading, then replaces it with the server message", async () => {
    let finishUpload;
    mocks.sendAttachment.mockImplementation(() => new Promise((resolve) => {
      finishUpload = resolve;
    }));
    const uploadedEvent = vi.fn();
    window.addEventListener("ricehub:chat-video-uploaded", uploadedEvent);

    render(
      <ChatUploadProvider>
        <UploadProbe />
      </ChatUploadProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Queue video" }));

    expect(await screen.findByTestId("upload-state"))
      .toHaveTextContent("uploading:clip.mp4");
    await waitFor(() => {
      expect(mocks.sendAttachment).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ name: "clip.mp4" }),
        5,
        "video"
      );
    });
    expect(mocks.saveChatUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 42,
        status: "uploading",
        fileName: "clip.mp4",
      })
    );

    finishUpload({ id: 99, attachment: "/media/clip.mp4" });
    await waitFor(() => {
      expect(screen.getByTestId("upload-state")).toBeEmptyDOMElement();
      expect(mocks.removeChatUpload).toHaveBeenCalledWith(expect.stringMatching(/^local-video-/));
    });
    expect(uploadedEvent).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:queued-video");
    window.removeEventListener("ricehub:chat-video-uploaded", uploadedEvent);
  });

  it("resumes a pending upload restored from IndexedDB", async () => {
    const file = new File(["video"], "saved-clip.mp4", { type: "video/mp4" });
    mocks.getChatUploads.mockResolvedValue([{
      id: "local-video-saved",
      conversationId: 42,
      userId: 7,
      file,
      fileName: file.name,
      fileType: file.type,
      replyToId: null,
      status: "uploading",
      retryable: true,
    }]);
    mocks.sendAttachment.mockResolvedValue({ id: 100, attachment: "/media/saved-clip.mp4" });

    render(
      <ChatUploadProvider>
        <UploadProbe />
      </ChatUploadProvider>
    );

    await waitFor(() => {
      expect(mocks.sendAttachment).toHaveBeenCalledWith(
        42,
        file,
        null,
        "video"
      );
      expect(mocks.removeChatUpload).toHaveBeenCalledWith("local-video-saved");
    });
  });
});
