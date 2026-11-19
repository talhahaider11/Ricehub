import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const MIME_TYPES = [
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export default function InAppVideoRecorder({ onCapture, onClose }) {
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  };

  const startCamera = async (mode = facingMode) => {
    stopStream();
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setError("");
    } catch (cameraError) {
      setError(cameraError.message || "Camera access could not be started.");
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  const close = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    stopStream();
    onClose?.();
  };

  const startRecording = () => {
    if (!streamRef.current || !window.MediaRecorder) {
      setError("Video recording is not supported on this device.");
      return;
    }

    const mimeType = MIME_TYPES.find((type) =>
      window.MediaRecorder.isTypeSupported?.(type)
    );
    const recorder = new window.MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined
    );
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      setRecording(false);
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: type.split(";")[0] });
      if (!blob.size) {
        setError("The video recording was empty.");
        return;
      }
      const extension = type.startsWith("video/mp4") ? "mp4" : "webm";
      const file = new File([blob], `VID_${Date.now()}.${extension}`, {
        type: blob.type,
      });
      stopStream();
      onCapture?.(file);
    };
    recorder.onerror = () => {
      recorderRef.current = null;
      setRecording(false);
      setError("Video recording failed.");
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const flipCamera = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  return (
    <div className="camera-capture-backdrop">
      <section className="camera-capture-dialog" role="dialog" aria-modal="true">
        <header>
          <h2>Record video</h2>
          <button type="button" onClick={close} aria-label="Close recorder">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" />
        {error && <p className="error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="btn btn-secondary" onClick={flipCamera}>
            Flip camera
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={recording ? stopRecording : startRecording}
            disabled={!stream}
          >
            {recording ? "Stop recording" : "Start recording"}
          </button>
        </footer>
      </section>
    </div>
  );
}
