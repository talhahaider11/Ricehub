import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessageInput from "./MessageInput";

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:message-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    delete navigator.mediaDevices;
  }
  if (secureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
  } else {
    delete window.isSecureContext;
  }
  if (createObjectURLDescriptor) {
    Object.defineProperty(URL, "createObjectURL", createObjectURLDescriptor);
  } else {
    delete URL.createObjectURL;
  }
  if (revokeObjectURLDescriptor) {
    Object.defineProperty(URL, "revokeObjectURL", revokeObjectURLDescriptor);
  } else {
    delete URL.revokeObjectURL;
  }
});

describe("MessageInput", () => {
  it("previews a selected attachment and sends only after confirmation", async () => {
    const onSendAttachment = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={vi.fn()} onSendAttachment={onSendAttachment} />);
    const file = new File(["photo"], "photo.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("Choose a photo or video"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("region", { name: "Attachment preview" }))
      .toBeInTheDocument();
    expect(onSendAttachment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send attachment" }));
    await waitFor(() => {
      expect(onSendAttachment).toHaveBeenCalledWith(file, undefined, "image");
    });
  });

  it("previews a photo captured from the in-app camera before sending", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["photo"], { type: "image/jpeg" }));
    });
    const onSendAttachment = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={vi.fn()} onSendAttachment={onSendAttachment} />);

    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    const video = await screen.findByLabelText("Camera preview");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));

    expect(await screen.findByRole("region", { name: "Attachment preview" }))
      .toBeInTheDocument();
    expect(onSendAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send attachment" }));

    await waitFor(() => {
      expect(onSendAttachment).toHaveBeenCalledOnce();
      expect(onSendAttachment.mock.calls[0][0]).toMatchObject({
        type: "image/jpeg",
      });
      expect(onSendAttachment.mock.calls[0].slice(1)).toEqual([undefined, "image"]);
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("rejects files larger than the message attachment limit", async () => {
    const onSendAttachment = vi.fn();
    render(<MessageInput onSend={vi.fn()} onSendAttachment={onSendAttachment} />);
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "clip.mp4", {
      type: "video/mp4",
    });

    fireEvent.change(screen.getByLabelText("Choose a photo or video"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Photos and videos must be 10 MB or smaller."
    );
    expect(onSendAttachment).not.toHaveBeenCalled();
  });

  it("requests microphone permission from a user action and shows retry guidance when denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(
      Object.assign(new Error("Permission denied"), { name: "NotAllowedError" })
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });

    render(<MessageInput onSend={vi.fn()} onSendAttachment={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Record voice note" }));

    expect(await screen.findByText(/Allow Microphone in your phone settings/))
      .toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    fireEvent.click(screen.getByRole("button", { name: "Request microphone access again" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
