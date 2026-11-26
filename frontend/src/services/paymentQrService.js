import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const PAYMENT_QR_IMAGE = "/images/talha-shop-qr.png";
export const PAYMENT_QR_FILENAME = "Talha-Shop-Payment-QR.png";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(reader.error || new Error("The QR image could not be read."));
    };
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The QR image could not be converted."));
        return;
      }
      const separatorIndex = reader.result.indexOf(",");
      if (separatorIndex < 0) {
        reject(new Error("The QR image data is invalid."));
        return;
      }
      resolve(reader.result.slice(separatorIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function downloadPaymentQr() {
  const response = await fetch(PAYMENT_QR_IMAGE);
  if (!response.ok) {
    throw new Error(`QR image request failed with status ${response.status}.`);
  }
  const blob = await response.blob();

  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: PAYMENT_QR_FILENAME,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    if (!uri) {
      throw new Error("The QR image was saved without a shareable file URI.");
    }

    const { value: canShare } = await Share.canShare();
    if (!canShare) {
      throw new Error("Sharing files is not available on this device.");
    }

    await Share.share({
      title: "Talha Shop Payment QR",
      text: "Save this QR image to your device to scan it in your payment app.",
      files: [uri],
      dialogTitle: "Save payment QR code",
    });
    return "shared";
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = PAYMENT_QR_FILENAME;
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return "downloaded";
}
