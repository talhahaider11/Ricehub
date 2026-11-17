import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function NativeCameraActions({
  disabled = false,
  onCapture,
}) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const captureFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onCapture?.(file);
  };

  const openCapture = (inputRef) => {
    setMenuOpen(false);
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
        aria-label={t("takePhoto")}
        onChange={captureFile}
      />
      <input
        ref={videoInputRef}
        className="native-camera-input"
        type="file"
        accept="video/*"
        capture="environment"
        aria-label={t("recordVideo")}
        onChange={captureFile}
      />
      <button
        type="button"
        className="native-camera-trigger"
        disabled={disabled}
        aria-label={t("camera")}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Camera size={18} aria-hidden="true" />
        <span>{t("camera")}</span>
      </button>
      {menuOpen && (
        <div className="native-camera-menu" role="menu" aria-label={t("camera")}>
          <button
            type="button"
            role="menuitem"
            onClick={() => openCapture(photoInputRef)}
          >
            {t("takePhoto")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openCapture(videoInputRef)}
          >
            {t("recordVideo")}
          </button>
        </div>
      )}
    </div>
  );
}
