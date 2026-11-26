import { useRef } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { getMediaType } from "../../utils/media";

export default function NativeCameraActions({
  disabled = false,
  onCapture,
}) {
  const { t } = useLanguage();
  const inputRef = useRef(null);

  const captureFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onCapture?.(file, getMediaType(file));
  };

  return (
    <div className="native-camera-actions">
      <input
        ref={inputRef}
        className="native-camera-input"
        type="file"
        accept="image/*,video/*"
        capture="environment"
        aria-label={t("capturePhotoVideo")}
        onChange={captureFile}
      />
      <button
        type="button"
        className="native-camera-trigger"
        disabled={disabled}
        aria-label={t("camera")}
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={18} aria-hidden="true" />
        <span>{t("camera")}</span>
      </button>
    </div>
  );
}
