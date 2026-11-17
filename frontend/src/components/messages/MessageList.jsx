import {
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import { PhoneOff } from "lucide-react";
import MessageActions from "./MessageActions";
import { useLanguage } from "../../context/LanguageContext";
import Avatar from "../common/Avatar";
import { Link } from "react-router-dom";

const MESSAGE_ACTION_HOLD_MS = 1500;
const LONG_PRESS_MOVE_THRESHOLD = 12;
const REPLY_SWIPE_THRESHOLD = 64;
const REPLY_SWIPE_VERTICAL_LIMIT = 48;

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

export default function MessageList({
  messages,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onShare,
  conversationPartner,
  showVerificationWarning = false,
  latestConversationMessageId,
}) {
  const { t, language } = useLanguage();
  const bottomRef =
    useRef(null);
  const longPressTimer = useRef(null);
  const longPressOrigin = useRef(null);
  const replySwipeOrigin = useRef(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);

  useEffect(() => () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressOrigin.current = null;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const latestMessage = messages[messages.length - 1];
  const showLatestReceipt = Boolean(
    latestMessage
    && String(latestMessage.id) === String(
      latestConversationMessageId ?? latestMessage.id
    )
    && String(latestMessage.sender?.id ?? latestMessage.sender)
      === String(currentUser?.id)
  );

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  };

  const startLongPress = (event, messageId) => {
    if (
      !event.target.closest?.(".message-bubble")
      || (event.type === "pointerdown" && event.pointerType === "mouse")
      || longPressTimer.current
    ) return;

    const touchPoint = event.touches?.[0];
    const x = Number.isFinite(event.clientX)
      ? event.clientX
      : touchPoint?.clientX || 0;
    const y = Number.isFinite(event.clientY)
      ? event.clientY
      : touchPoint?.clientY || 0;
    longPressOrigin.current = { x, y };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressOrigin.current = null;
      window.navigator.vibrate?.(30);
      setLongPressedMessageId(messageId);
    }, MESSAGE_ACTION_HOLD_MS);
  };

  const moveLongPress = (event) => {
    if (!longPressTimer.current || !longPressOrigin.current) return;
    const touchPoint = event.touches?.[0];
    const x = Number.isFinite(event.clientX)
      ? event.clientX
      : touchPoint?.clientX || 0;
    const y = Number.isFinite(event.clientY)
      ? event.clientY
      : touchPoint?.clientY || 0;
    if (
      Math.abs(x - longPressOrigin.current.x) > LONG_PRESS_MOVE_THRESHOLD
      || Math.abs(y - longPressOrigin.current.y) > LONG_PRESS_MOVE_THRESHOLD
    ) {
      cancelLongPress();
    }
  };

  const startReplySwipe = (event, message) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch || !event.target.closest?.(".message-bubble")) {
      replySwipeOrigin.current = null;
      return;
    }

    replySwipeOrigin.current = {
      x: touch.clientX,
      y: touch.clientY,
      message,
    };
  };

  const finishReplySwipe = (event) => {
    const origin = replySwipeOrigin.current;
    const touch = event.changedTouches?.[0];
    replySwipeOrigin.current = null;
    cancelLongPress();
    if (!origin || !touch) return;

    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (
      deltaX <= -REPLY_SWIPE_THRESHOLD
      && Math.abs(deltaY) <= REPLY_SWIPE_VERTICAL_LIMIT
    ) {
      setLongPressedMessageId(null);
      onReply?.(origin.message);
    }
  };

  let previousDay = "";

  return (
    <div className="message-list">
      {conversationPartner && (
        <section className="chat-profile-hero">
          <Avatar user={conversationPartner} size="large" />
          <h2>
            {[conversationPartner.first_name, conversationPartner.last_name]
              .filter(Boolean)
              .join(" ") || conversationPartner.username}
          </h2>
          <p>@{conversationPartner.username}</p>
          <Link
            to={`/profile/${conversationPartner.id}`}
            className="chat-view-profile"
          >
            {t("viewProfile")}
          </Link>
          {showVerificationWarning && (
            <p className="chat-verification-banner" role="alert">
              {t("messageVerificationWarning")}
            </p>
          )}
        </section>
      )}
      {messages.map((message) => {
        const mine =
          String(message.sender?.id ?? message.sender) ===
          String(currentUser?.id);

        const timestamp = getTimestamp(message.created_at, language);
        const isVisualMedia = Boolean(
          message.attachment
          && ["image", "video"].includes(message.attachment_type)
        );
        const showReceipt = Boolean(
          mine
          && !message.call_id
          && showLatestReceipt
          && latestMessage.id === message.id
          && !message.upload_status
        );
        const showDateSeparator = timestamp && timestamp.day !== previousDay;
        if (timestamp) previousDay = timestamp.day;

        return (
          <Fragment key={message.id}>
            {showDateSeparator && (
              <div className="message-date-separator">
                <span>{timestamp.separator}</span>
              </div>
            )}
            <div
              className={[
                "message",
                mine ? "mine" : "",
                longPressedMessageId === message.id ? "is-action-selected" : "",
              ].filter(Boolean).join(" ")}
              onPointerDown={(event) => startLongPress(event, message.id)}
              onPointerMove={moveLongPress}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onTouchStart={(event) => startLongPress(event, message.id)}
              onTouchMove={moveLongPress}
              onTouchStartCapture={(event) => startReplySwipe(event, message)}
              onTouchEnd={finishReplySwipe}
              onTouchCancel={() => {
                cancelLongPress();
                replySwipeOrigin.current = null;
              }}
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
                  message.call_id ? "message-bubble--call-log" : "",
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
                      {message.call_id ? (
                        <p className="message-call-log">
                          <PhoneOff size={15} aria-hidden="true" />
                          <span>{t("callEndedLog")}</span>
                        </p>
                      ) : message.content && (
                        <p>
                          {message.content.split(/(https?:\/\/[^\s]+)/gi).map((part, index) => (
                            /^https?:\/\//i.test(part) ? (
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
                            <a href={message.attachment} target="_blank" rel="noreferrer">
                              <img
                                className="message-image-attachment"
                                src={message.attachment}
                                alt="Image attachment"
                                loading="lazy"
                              />
                            </a>
                          )}
                          {message.attachment_type === "video" && (
                            <video
                              className="message-video-attachment"
                              controls
                              playsInline
                              webkit-playsinline="true"
                              preload="auto"
                              src={message.attachment}
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
                {!isVisualMedia && timestamp && !message.is_deleted && (
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
              {!message.is_deleted && !message.upload_status && !message.call_id && (
                <MessageActions
                  message={message}
                  own={mine}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onShare={onShare}
                  open={longPressedMessageId === message.id}
                  onClose={() => setLongPressedMessageId(null)}
                />
              )}
            </div>
          </Fragment>
        );
      })}

      <div ref={bottomRef} />

    </div>
  );
}