import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

function shouldUseDeviceCamera() {
  const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobileUserAgent || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export default function CameraCapture({
  onCapture,
  disabled = false,
  className = "",
}) {
  const { t } = useLanguage();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");
  const [cameraDirection, setCameraDirection] = useState("environment");
  const videoRef = useRef(null);
  const photoInputRef = useRef(null);
  const streamRef = useRef(null);
  const openingRef = useRef(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  };

  useEffect(() => {
    if (!stream || !videoRef.current) return undefined;
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const openCamera = async () => {
    setError("");
    if (shouldUseDeviceCamera()) {
      openDeviceCapture();
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t("cameraUnsupported"));
      return;
    }

    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = cameraStream;
      setStream(cameraStream);
    } catch (cameraError) {
      console.error("Camera access could not be started:", cameraError);
      if (cameraError.name === "NotAllowedError" || cameraError.name === "SecurityError") {
        setError(t("cameraPermissionDenied"));
      } else if (cameraError.name === "NotFoundError" || cameraError.name === "DevicesNotFoundError") {
        setError(t("cameraNotFound"));
      } else {
        setError(cameraError.message || t("cameraPermissionDenied"));
      }
    } finally {
      openingRef.current = false;
    }
  };

  const openDeviceCapture = () => {
    photoInputRef.current?.click();
  };

  const toggleCameraDirection = () => {
    setCameraDirection((direction) => (
      direction === "environment" ? "user" : "environment"
    ));
  };

  const handleDeviceCapture = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    try {
      await onCapture(file);
    } catch (captureError) {
      console.error("Device camera capture could not be used:", captureError);
      setError(captureError.message || t("cameraCaptureFailed"));
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError(t("cameraNotReady"));
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1920 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (capturedBlob) => capturedBlob
            ? resolve(capturedBlob)
            : reject(new Error(t("cameraCaptureFailed"))),
          "image/jpeg",
          0.85
        );
      });
      const file = new File([blob], `ricehub-camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      stopCamera();
      await onCapture(file);
    } catch (captureError) {
      console.error("Camera photo could not be captured:", captureError);
      setError(captureError.message || t("cameraCaptureFailed"));
    }
  };

  return (
    <>
      <input
        ref={photoInputRef}
        className="camera-capture-input"
        type="file"
        accept="image/*"
        capture={cameraDirection}
        onChange={(event) => void handleDeviceCapture(event)}
        aria-label={t("takePhoto")}
        tabIndex={-1}
      />
      <button
        type="button"
        className={`camera-capture-trigger ${className}`.trim()}
        disabled={disabled}
        onClick={() => void openCamera()}
        aria-label={t("openCamera")}
        title={t("openCamera")}
      >
        <Camera size={18} aria-hidden="true" />
        <span>{t("camera")}</span>
      </button>
      {shouldUseDeviceCamera() && (
        <div className="camera-capture-device-controls">
          <button
            type="button"
            className="camera-capture-lens"
            onClick={toggleCameraDirection}
            aria-label={t(
              cameraDirection === "environment"
                ? "switchToFrontCamera"
                : "switchToBackCamera"
            )}
            title={t(
              cameraDirection === "environment"
                ? "switchToFrontCamera"
                : "switchToBackCamera"
            )}
          >
            <RefreshCw size={17} aria-hidden="true" />
            <span>
              {cameraDirection === "environment"
                ? t("backCamera")
                : t("frontCamera")}
            </span>
          </button>
        </div>
      )}
      {error && !stream && <p className="error camera-capture-error" role="alert">{error}</p>}
      {stream && (
        <div className="camera-capture-backdrop">
          <section
            className="camera-capture-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("camera")}
          >
            <header>
              <h2>{t("takePhoto")}</h2>
              <button type="button" onClick={stopCamera} aria-label={t("closeCamera")}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label={t("cameraPreview")}
            />
            {error && <p className="error" role="alert">{error}</p>}
            <footer>
              <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                {t("cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void capturePhoto()}>
                <Camera size={17} aria-hidden="true" />
                {t("takePhoto")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
