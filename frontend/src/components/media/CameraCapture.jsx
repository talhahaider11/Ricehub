import { useEffect, useRef, useState } from "react";
import { Camera, Circle, Square, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

const HOLD_TO_RECORD_DELAY_MS = 350;
const MAX_VIDEO_RECORDING_MS = 30_000;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const VIDEO_MIME_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export default function CameraCapture({
  onCapture,
  disabled = false,
  className = "",
}) {
  const { t } = useLanguage();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const openingRef = useRef(false);
  const recorderRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const holdTriggeredRef = useRef(false);

  const stopCamera = () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setRecording(false);
  };

  useEffect(() => {
    if (!stream || !videoRef.current) return undefined;
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => {
    if (holdTimeoutRef.current) window.clearTimeout(holdTimeoutRef.current);
    clearRecordingTimers();
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const openCamera = async () => {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t("cameraUnsupported"));
      return;
    }

    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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

  const clearRecordingTimers = () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const stopRecording = () => {
    clearRecordingTimers();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    if (!window.MediaRecorder) {
      setError(t("videoRecordingUnsupported"));
      return;
    }

    try {
      const supportedMimeType = VIDEO_MIME_TYPES.find(
        (mimeType) => window.MediaRecorder.isTypeSupported?.(mimeType)
      );
      const options = {
        videoBitsPerSecond: 1_300_000,
        audioBitsPerSecond: 64_000,
        ...(supportedMimeType ? { mimeType: supportedMimeType } : {}),
      };
      const recorder = new window.MediaRecorder(streamRef.current, options);
      const chunks = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = (recordingError) => {
        console.error("Camera video recording failed:", recordingError);
        setError(t("videoRecordingFailed"));
        stopCamera();
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        recorderRef.current = null;
        setRecording(false);
        const recordingStream = streamRef.current;
        recordingStream?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);

        const rawType = recorder.mimeType || chunks[0]?.type || "video/webm";
        const mimeType = rawType.split(";")[0];
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size) {
          setError(t("videoRecordingFailed"));
          return;
        }
        if (blob.size > MAX_ATTACHMENT_SIZE) {
          setError(t("photoVideoSizeError"));
          return;
        }
        const extension = mimeType === "video/mp4" ? "mp4" : "webm";
        const file = new File([blob], `ricehub-camera-${Date.now()}.${extension}`, {
          type: mimeType,
        });
        Promise.resolve().then(() => onCapture(file)).catch((captureError) => {
          console.error("Recorded video could not be used:", captureError);
          setError(captureError.message || t("cameraCaptureFailed"));
        });
      };
      recorder.start(250);
      setError("");
      setRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => Math.min(seconds + 1, 30));
      }, 1000);
      recordingTimeoutRef.current = window.setTimeout(
        stopRecording,
        MAX_VIDEO_RECORDING_MS
      );
    } catch (recordingError) {
      console.error("Camera video recording could not be started:", recordingError);
      recorderRef.current = null;
      setError(recordingError.message || t("videoRecordingFailed"));
    }
  };

  const beginCapturePress = (event) => {
    if (event.type === "pointerdown" && event.button > 0) return;
    if (recording || holdTimeoutRef.current) return;
    event.preventDefault();
    holdTriggeredRef.current = false;
    holdTimeoutRef.current = window.setTimeout(() => {
      holdTimeoutRef.current = null;
      holdTriggeredRef.current = true;
      startVideoRecording();
    }, HOLD_TO_RECORD_DELAY_MS);
  };

  const finishCapturePress = () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdTriggeredRef.current) {
      stopRecording();
      holdTriggeredRef.current = false;
      return;
    }
    void capturePhoto();
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
            <p className="camera-capture-hint" aria-live="polite">
              {recording
                ? t("recordingVideo", { seconds: recordingSeconds })
                : t("holdToRecordVideo")}
            </p>
            {error && <p className="error" role="alert">{error}</p>}
            <footer>
              <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className={`btn btn-primary camera-capture-shutter${recording ? " is-recording" : ""}`}
                aria-label={recording ? t("stopVideoRecording") : t("holdToRecordVideo")}
                disabled={disabled && !recording}
                onPointerDown={beginCapturePress}
                onPointerUp={finishCapturePress}
                onPointerCancel={finishCapturePress}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") beginCapturePress(event);
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") finishCapturePress();
                }}
              >
                {recording ? (
                  <>
                    <Square size={17} aria-hidden="true" />
                    {t("stopVideoRecording")}
                  </>
                ) : (
                  <>
                    <Circle size={17} aria-hidden="true" />
                    {t("takePhoto")}
                  </>
                )}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
