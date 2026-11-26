import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  downloadPaymentQr,
  PAYMENT_QR_FILENAME,
  PAYMENT_QR_IMAGE,
} from "./paymentQrService";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
  registerPlugin: vi.fn(() => ({ saveImage: vi.fn() })),
}));

const gallerySaver = registerPlugin.mock.results[0].value;

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

  it("saves the QR image directly into the Android gallery", async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    gallerySaver.saveImage.mockResolvedValue({
      uri: "content://media/external/images/1",
    });

    await expect(downloadPaymentQr()).resolves.toBe("saved");

    expect(gallerySaver.saveImage).toHaveBeenCalledWith({
      fileName: PAYMENT_QR_FILENAME,
      data: "cXItaW1hZ2U=",
    });
  });

  it("surfaces a failed QR image request", async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(downloadPaymentQr()).rejects.toThrow(
      "QR image request failed with status 404."
    );
  });
});
