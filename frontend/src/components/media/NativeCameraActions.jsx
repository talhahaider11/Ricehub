import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { getMediaType } from "../../utils/media";

export default function NativeCameraActions({
  disabled = false,
  onCapture,
}) {
  const { t } = useLanguage();
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const captureFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setIsOpen(false);
    if (file) onCapture?.(file, getMediaType(file));
  };

  const openCaptureChoice = (inputRef) => {
    setIsOpen(false);
    inputRef.current?.click();
  };

  return (
    <div className="native-camera-actions">
      <input
        ref={photoInputRef}
        className="native-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={t("capturePhoto")}
        onChange={captureFile}
      />
      <input
        ref={videoInputRef}
        className="native-camera-input"
        type="file"
        accept="video/*"
        capture="environment"
        aria-label={t("captureVideo")}
        onChange={captureFile}
      />
      <button
        type="button"
        className="native-camera-trigger"
        disabled={disabled}
        aria-label={t("camera")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Camera size={18} aria-hidden="true" />
        <span>{t("camera")}</span>
      </button>
      {isOpen && (
        <div className="native-camera-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => openCaptureChoice(photoInputRef)}
          >
            {t("takePhoto")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openCaptureChoice(videoInputRef)}
          >
            {t("captureVideo")}
          </button>
        </div>
      )}
    </div>
  );
}
