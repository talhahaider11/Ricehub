import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Square } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import CameraCapture from "../media/CameraCapture";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export default function MessageInput({
  onSend,
  onSendAttachment,
  onTyping,
  disabled = false,
  replyTarget,
  onCancelReply,
}) {
  const { t } = useLanguage();
  const [message, setMessage] =
    useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const attachmentInputRef = useRef(null);

  useEffect(() => () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
    }
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!pendingAttachment) {
      setAttachmentPreviewUrl("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(pendingAttachment);
    setAttachmentPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [pendingAttachment]);

  const submit = async (event) => {
    event.preventDefault();
    const content = message.trim();
    if (!content || disabled || sending) {
      return;
    }

    try {
      setSending(true);
      setError("");
      await onSend(content, replyTarget?.id);
      setMessage("");
      onCancelReply?.();
      onTyping?.(false);
    } catch (sendError) {
      setError(sendError.message || t("messageSendFailed"));
    } finally {
      setSending(false);
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const sendAttachmentFile = async (file) => {
    if (!file) return;

    const attachmentType = IMAGE_TYPES.has(file.type)
      ? "image"
      : VIDEO_TYPES.has(file.type)
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
    if (!attachmentType) {
      setError(t("photoVideoTypeError"));
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(file.type.startsWith("audio/")
        ? t("voiceSizeError")
        : t("photoVideoSizeError"));
      return;
    }

    try {
      setSending(true);
      setError("");
      await onSendAttachment(file, replyTarget?.id, attachmentType);
      onCancelReply?.();
      return true;
    } catch (sendError) {
      setError(sendError.message || (
        attachmentType === "audio" ? t("voiceSendFailed") : t("photoVideoSendFailed")
      ));
      return false;
    } finally {
      setSending(false);
    }
  };

  const queueAttachmentFile = (file) => {
    if (!file) return;
    const supported = IMAGE_TYPES.has(file.type)
      || VIDEO_TYPES.has(file.type)
      || file.type.startsWith("audio/");
    if (!supported) {
      setError(t("photoVideoTypeError"));
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(file.type.startsWith("audio/")
        ? t("voiceSizeError")
        : t("photoVideoSizeError"));
      return;
    }
    setError("");
    setPendingAttachment(file);
  };

  const confirmAttachment = async () => {
    if (!pendingAttachment || sending || disabled) return;
    if (await sendAttachmentFile(pendingAttachment)) {
      setPendingAttachment(null);
    }
  };

  const sendSelectedAttachment = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    queueAttachmentFile(file);
  };

  const startRecording = async () => {
    setError("");
    setPermissionDenied(false);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(t("voiceUnsupported"));
      return;
    }
    if (!window.isSecureContext) {
      setError(t("microphoneSecureContext"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setError(t("recordingFailed"));
        stopRecording();
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, {
          type: recorder.mimeType || chunks[0]?.type || "audio/webm",
        });
        if (!blob.size) return;
        if (blob.size > 10 * 1024 * 1024) {
          setError(t("voiceSizeError"));
          return;
        }
        const extension = blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mp4")
            ? "m4a"
            : blob.type.includes("mpeg")
              ? "mp3"
              : blob.type.includes("wav")
                ? "wav"
                : "webm";
        const file = new File([blob], `voice-note.${extension}`, { type: blob.type });
        setPendingAttachment(file);
      };
      recorder.start();
      setRecording(true);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, 120_000);
    } catch (recordError) {
      console.error("Microphone access could not be started:", recordError);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (recordError.name === "NotAllowedError" || recordError.name === "SecurityError") {
        setPermissionDenied(true);
        setError(t("microphoneDenied"));
      } else if (recordError.name === "NotFoundError" || recordError.name === "DevicesNotFoundError") {
        setError(t("microphoneNotFound"));
      } else {
        setError(recordError.message || t("microphoneDenied"));
      }
    }
  };

  return (
    <>
      {pendingAttachment && (
        <section className="message-attachment-preview" aria-label={pendingAttachment.type.startsWith("audio/") ? t("voiceMessagePreview") : t("attachmentPreview")}>
          {pendingAttachment.type.startsWith("audio/") ? (
            <audio controls preload="metadata" src={attachmentPreviewUrl}>
              {t("audioUnsupported")}
            </audio>
          ) : pendingAttachment.type.startsWith("video/") ? (
            <video controls playsInline preload="metadata" src={attachmentPreviewUrl}>
              {t("videoUnsupported")}
            </video>
          ) : (
            <img src={attachmentPreviewUrl} alt={t("attachmentPreview")} />
          )}
          <div className="message-attachment-preview-actions">
            <button
              type="button"
              className="message-attachment-cancel"
              disabled={sending}
              onClick={() => setPendingAttachment(null)}
            >
              {t("cancelAttachment")}
            </button>
            <button
              type="button"
              className="message-attachment-send"
              disabled={sending || disabled}
              onClick={() => void confirmAttachment()}
            >
              {sending ? t("sending") : t("sendAttachment")}
            </button>
          </div>
        </section>
      )}
      {replyTarget && (
        <div className="message-reply-target">
          <span>{t("replyTo")} {replyTarget.content}</span>
          <button type="button" onClick={onCancelReply}>{t("cancel")}</button>
        </div>
      )}
      <form className="message-input" onSubmit={submit}>
        <input
          ref={attachmentInputRef}
          className="message-attachment-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          onChange={sendSelectedAttachment}
          aria-label={t("choosePhotoVideo")}
          tabIndex={-1}
        />
        {onSendAttachment && (
          <button
            type="button"
            disabled={disabled || sending || recording}
            onClick={() => attachmentInputRef.current?.click()}
            aria-label={t("sendPhotoVideo")}
            title={t("sendPhotoVideo")}
          >
            <ImagePlus size={16} aria-hidden="true" />
          </button>
        )}
        {onSendAttachment && (
          <CameraCapture
            disabled={disabled || sending || recording}
            onCapture={queueAttachmentFile}
          />
        )}
        <input
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            onTyping?.(Boolean(event.target.value.trim()));
          }}
          placeholder={t("writeMessage")}
          maxLength={5000}
          disabled={disabled || sending || recording}
          aria-label={t("writeMessage")}
        />
        <button type="submit" disabled={disabled || sending || recording || !message.trim()}>
          {sending ? t("sending") : t("send")}
        </button>
        {onSendAttachment && !recording && (
          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => void startRecording()}
            aria-label={t("recordVoiceNote")}
            title={t("voiceNote")}
          >
            <Mic size={16} aria-hidden="true" />
            <span className="message-input-button-label">{t("voiceNote")}</span>
          </button>
        )}
        {recording && (
          <button type="button" onClick={stopRecording} aria-label={t("stopRecording")}>
            <Square size={15} aria-hidden="true" />
            {t("stopRecording")}
          </button>
        )}
        {error && <span className="error" role="alert">{error}</span>}
        {permissionDenied && (
          <div className="message-permission-help" role="group" aria-label={t("microphoneDenied")}>
            <p>{t("microphonePermissionSteps")}</p>
            <button type="button" onClick={() => void startRecording()}>
              {t("requestMicAgain")}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
