import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";

export const PAYMENT_QR_IMAGE = "/images/talha-shop-qr.png";
export const PAYMENT_QR_FILENAME = "Talha-Shop-QR.png";
const GallerySaver = registerPlugin("GallerySaver");

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
    const { uri } = await GallerySaver.saveImage({
      fileName: PAYMENT_QR_FILENAME,
      data,
    });
    if (!uri) {
      throw new Error("The QR image was saved without a gallery URI.");
    }
    return "saved";
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
