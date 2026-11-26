import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  downloadPaymentQr,
  PAYMENT_QR_FILENAME,
  PAYMENT_QR_IMAGE,
} from "./paymentQrService";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Documents: "DOCUMENTS" },
  Filesystem: { writeFile: vi.fn() },
}));

vi.mock("@capacitor/share", () => ({
  Share: {
    canShare: vi.fn(),
    share: vi.fn(),
  },
}));

describe("downloadPaymentQr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(["qr-image"], { type: "image/png" })),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads a named PNG file in web browsers", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:payment-qr"),
      revokeObjectURL: vi.fn(),
    });
    const clickLink = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click() {
        expect(this.download).toBe(PAYMENT_QR_FILENAME);
        expect(this.href).toBe("blob:payment-qr");
      });

    await expect(downloadPaymentQr()).resolves.toBe("downloaded");

    expect(fetch).toHaveBeenCalledWith(PAYMENT_QR_IMAGE);
    expect(clickLink).toHaveBeenCalledOnce();
  });

  it("writes and shares a persistent file from Capacitor Android", async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    Filesystem.writeFile.mockResolvedValue({
      uri: "file:///documents/Talha-Shop-Payment-QR.png",
    });
    Share.canShare.mockResolvedValue({ value: true });
    Share.share.mockResolvedValue({});

    await expect(downloadPaymentQr()).resolves.toBe("shared");

    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: PAYMENT_QR_FILENAME,
      data: "cXItaW1hZ2U=",
      directory: Directory.Documents,
      recursive: true,
    });
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      files: ["file:///documents/Talha-Shop-Payment-QR.png"],
      dialogTitle: "Save payment QR code",
    }));
  });

  it("surfaces a failed QR image request", async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(downloadPaymentQr()).rejects.toThrow(
      "QR image request failed with status 404."
    );
  });
});
