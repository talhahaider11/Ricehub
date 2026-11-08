import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

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
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
    }
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
      setError(sendError.message || "Message could not be sent.");
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

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(t("voiceUnsupported"));
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
        try {
          setSending(true);
          await onSendAttachment?.(file, replyTarget?.id);
          onCancelReply?.();
        } catch (sendError) {
          setError(sendError.message || t("voiceSendFailed"));
        } finally {
          setSending(false);
        }
      };
      recorder.start();
      setRecording(true);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, 120_000);
    } catch (recordError) {
      console.error("Microphone access could not be started:", recordError);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(t("microphoneDenied"));
    }
  };

  return (
    <>
      {replyTarget && (
        <div className="message-reply-target">
          <span>Replying to: {replyTarget.content}</span>
          <button type="button" onClick={onCancelReply}>Cancel</button>
        </div>
      )}
      <form className="message-input" onSubmit={submit}>
        <input
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            onTyping?.(Boolean(event.target.value.trim()));
          }}
          placeholder="Write a message..."
          maxLength={5000}
          disabled={disabled || sending || recording}
          aria-label="Write a message"
        />
        <button type="submit" disabled={disabled || sending || recording || !message.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
        {onSendAttachment && !recording && (
          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => void startRecording()}
            aria-label="Record voice note"
          >
            <Mic size={16} aria-hidden="true" />
            {t("voiceNote")}
          </button>
        )}
        {recording && (
          <button type="button" onClick={stopRecording} aria-label="Stop voice recording">
            <Square size={15} aria-hidden="true" />
            {t("stopRecording")}
          </button>
        )}
        {error && <span className="error" role="alert">{error}</span>}
      </form>
    </>
  );
}
