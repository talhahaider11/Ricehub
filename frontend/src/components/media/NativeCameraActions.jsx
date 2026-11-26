import { useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useLanguage } from "../../context/LanguageContext";
import { getMediaType } from "../../utils/media";

const VIDEO_HOLD_DURATION_MS = 400;

export default function NativeCameraActions({
  disabled = false,
  onCapture,
}) {
  const { t } = useLanguage();
  const isNative = Capacitor.isNativePlatform();
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const combinedInputRef = useRef(null);
  const holdTimerRef = useRef(null);
  const pointerDownRef = useRef(false);
  const longPressRef = useRef(false);

  const captureFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onCapture?.(file, getMediaType(file));
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => clearHoldTimer, []);

  const beginPress = () => {
    if (disabled || !isNative) return;
    clearHoldTimer();
    pointerDownRef.current = true;
    longPressRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      if (!pointerDownRef.current) return;
      longPressRef.current = true;
      videoInputRef.current?.click();
    }, VIDEO_HOLD_DURATION_MS);
  };

  const endPress = (event) => {
    pointerDownRef.current = false;
    clearHoldTimer();
    if (longPressRef.current) {
      event?.preventDefault();
      window.setTimeout(() => {
        longPressRef.current = false;
      }, 0);
    }
  };

  const openCamera = (event) => {
    if (longPressRef.current) {
      longPressRef.current = false;
      event.preventDefault();
      return;
    }
    (isNative ? photoInputRef : combinedInputRef).current?.click();
  };

  return (
    <div className="native-camera-actions">
      {isNative ? (
        <>
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
        </>
      ) : (
        <input
          ref={combinedInputRef}
          className="native-camera-input"
          type="file"
          accept="image/*,video/*"
          capture="environment"
          aria-label={t("capturePhotoVideo")}
          onChange={captureFile}
        />
      )}
      <button
        type="button"
        className="native-camera-trigger"
        disabled={disabled}
        aria-label={t("camera")}
        onPointerDown={beginPress}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onContextMenu={(event) => event.preventDefault()}
        onClick={openCamera}
      >
        <Camera size={18} aria-hidden="true" />
        <span>{t("camera")}</span>
      </button>
    </div>
  );
}
