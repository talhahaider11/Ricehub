import { memo, useMemo } from "react";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import MessageActions from "./MessageActions";
import { getMemoizedChatMediaUrl } from "../../services/messageCache";

const MEDIA_URL_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4v",
  ".mov",
  ".mp4",
  ".png",
  ".webm",
  ".webp",
]);

function getTimestamp(value, language) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const dateLabel = new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat(language, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return {
    day: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    separator: `${dateLabel} at ${timeLabel}`.toUpperCase(),
    time: timeLabel,
  };
}

function formatCallLogDuration(seconds, t) {
  if (!Number.isInteger(seconds) || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return t("callDurationSeconds", { count: seconds });
  if (remainingSeconds === 0) return t("callDurationMinutes", { count: minutes });
  return t("callDurationMinutesSeconds", {
    minutes,
    seconds: remainingSeconds,
  });
}

function shouldOpenExternalLink(url) {
  try {
    const parsedUrl = new URL(url.replace(/[),.;!?]+$/, ""));
    const hostname = parsedUrl.hostname.toLowerCase();
    const extension = parsedUrl.pathname.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    return hostname !== "oraclecloud.com"
      && !hostname.endsWith(".oraclecloud.com")
      && !MEDIA_URL_EXTENSIONS.has(extension);
  } catch {
    return false;
  }
}

const MessageItem = memo(function MessageItem({
  message,
  currentUserId,
  conversationId,
  showReceipt,
  canCallBack,
  actionsOpen,
  onPointerDown,
  onPointerMove,
  onCancelLongPress,
  onTouchStart,
  onMoveLongPress,
  onTouchStartCapture,
  onTouchEnd,
  onTouchCancel,
  onReply,
  onEdit,
  onDelete,
  onShare,
  onCallBack,
  onCloseActions,
  onPreviewImage,
}) {
  const { t, language } = useLanguage();
  const mine = String(message.sender?.id ?? message.sender) === String(currentUserId);
  const timestamp = getTimestamp(message.created_at, language);
  const isCallLog = message.message_type === "call_log" || Boolean(message.call_id);
  const missedIncomingCall = isCallLog
    && ["missed", "unanswered", "cancelled"].includes(message.call_status)
    && !mine;
  const CallIcon = missedIncomingCall
    ? PhoneMissed
    : mine
      ? PhoneOutgoing
      : PhoneIncoming;
  const callSubtitle = message.call_status === "completed"
    ? formatCallLogDuration(message.call_duration_seconds, t)
    : missedIncomingCall
      ? t("tapToCallBack")
      : message.call_status === "cancelled"
        ? t("callEnded")
        : t("noAnswer");
  const mediaUrl = useMemo(
    () => getMemoizedChatMediaUrl(
      conversationId,
      currentUserId,
      message.id,
      message.attachment
    ),
    [conversationId, currentUserId, message.id, message.attachment]
  );
  const isVisualMedia = Boolean(
    mediaUrl && ["image", "video"].includes(message.attachment_type)
  );

  const callCardBody = (
    <>
      <span className={[
        "message-call-icon",
        missedIncomingCall ? "is-missed" : "",
      ].filter(Boolean).join(" ")}>
        <CallIcon size={19} aria-hidden="true" />
      </span>
      <span className="message-call-copy">
        <strong>{t(missedIncomingCall ? "missedVoiceCall" : "voiceCall")}</strong>
        {callSubtitle && <small>{callSubtitle}</small>}
      </span>
      {timestamp && (
        <time className="message-call-time" dateTime={message.created_at}>
          {timestamp.time}
        </time>
      )}
    </>
  );

  return (
    <div
      className={[
        "message",
        mine ? "mine" : "",
        actionsOpen ? "is-action-selected" : "",
      ].filter(Boolean).join(" ")}
      onPointerDown={(event) => onPointerDown(event, message.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onCancelLongPress}
      onPointerCancel={onCancelLongPress}
      onPointerLeave={onCancelLongPress}
      onTouchStart={(event) => onTouchStart(event, message.id)}
      onTouchMove={onMoveLongPress}
      onTouchStartCapture={(event) => onTouchStartCapture(event, message)}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={[
          "message-bubble",
          message.attachment_type === "image" || message.attachment_type === "video"
            ? "message-bubble--media"
            : "",
          message.attachment_type === "audio" && message.attachment
            ? "message-bubble--audio"
            : "",
          message.upload_status === "uploading" ? "message-bubble--uploading" : "",
          isCallLog ? "message-bubble--call-log" : "",
        ].filter(Boolean).join(" ")}
      >
        {message.reply_to && (
          <blockquote className="message-reply-preview">
            {message.reply_to.content}
          </blockquote>
        )}
        {message.is_deleted
          ? t("messageDeleted")
          : (
            <>
              {isCallLog ? (
                missedIncomingCall && canCallBack ? (
                  <button
                    type="button"
                    className="message-call-card message-call-card--missed"
                    aria-label={`${t("missedVoiceCall")}. ${t("tapToCallBack")}`}
                    onClick={() => onCallBack(message)}
                  >
                    {callCardBody}
                  </button>
                ) : (
                  <div className={[
                    "message-call-card",
                    missedIncomingCall ? "message-call-card--missed" : "",
                  ].filter(Boolean).join(" ")}>
                    {callCardBody}
                  </div>
                )
              ) : message.content && (
                <p>
                  {message.content.split(/(https?:\/\/[^\s]+)/gi).map((part, index) => (
                    /^https?:\/\//i.test(part) && shouldOpenExternalLink(part) ? (
                      <a
                        key={`${message.id}-link-${index}`}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {part}
                      </a>
                    ) : part
                  ))}
                </p>
              )}
              {message.attachment_type === "audio" && message.attachment && (
                <audio controls preload="metadata" src={message.attachment}>
                  {t("audioUnsupported")}
                </audio>
              )}
              {isVisualMedia && (
                <div className="message-media-frame">
                  {message.attachment_type === "image" && (
                    <button
                      type="button"
                      className="message-media-preview-trigger"
                      aria-label="Open image preview"
                      onClick={() => onPreviewImage(mediaUrl)}
                    >
                      <img
                        className="message-image-attachment"
                        src={mediaUrl}
                        alt="Image attachment"
                        loading="eager"
                        decoding="async"
                      />
                    </button>
                  )}
                  {message.attachment_type === "video" && (
                    <video
                      className="message-video-attachment"
                      src={mediaUrl}
                      controls
                      playsInline
                      webkit-playsinline="true"
                      preload="metadata"
                    >
                      {t("videoUnsupported")}
                    </video>
                  )}
                  {message.upload_status === "uploading"
                    && message.attachment_type === "video" && (
                      <span
                        className="message-video-upload-indicator"
                        role="status"
                        aria-label={t("sending")}
                      >
                        <span />
                      </span>
                  )}
                  {!message.is_deleted && (timestamp || showReceipt) && (
                    <div className="message-media-meta">
                      {timestamp && (
                        <time className="message-time" dateTime={message.created_at}>
                          {timestamp.time}
                        </time>
                      )}
                      {showReceipt && (
                        <small className="message-receipt">
                          {message.is_read ? t("seen") : t("sent")}
                        </small>
                      )}
                    </div>
                  )}
                </div>
              )}
              {message.upload_status === "failed" && (
                <small className="message-video-upload-error" role="status">
                  {t("videoUploadFailed")}
                </small>
              )}
            </>
          )}
        {!isVisualMedia && !isCallLog && timestamp && !message.is_deleted && (
          <time className="message-time" dateTime={message.created_at}>
            {timestamp.time}
          </time>
        )}
        {!isVisualMedia && showReceipt && (
          <small className="message-receipt">
            {message.is_read ? t("seen") : t("sent")}
          </small>
        )}
      </div>
      {message.edited_at && !message.is_deleted && (
        <small className="message-edited-label">{t("edited")}</small>
      )}
      {message.verification_warning && !mine && (
        <small className="message-verification-warning" role="alert">
          {t("unverifiedWarning")}
        </small>
      )}
      {!message.is_deleted && !message.upload_status && !isCallLog && (
        <MessageActions
          message={message}
          own={mine}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onShare={onShare}
          open={actionsOpen}
          onClose={onCloseActions}
        />
      )}
    </div>
  );
});

export default MessageItem;
