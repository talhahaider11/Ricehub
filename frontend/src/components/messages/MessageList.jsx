import {
  useEffect,
  useRef,
  useState,
} from "react";
import MessageActions from "./MessageActions";
import { useLanguage } from "../../context/LanguageContext";

export default function MessageList({
  messages,
  currentUser,
  onReply,
  onEdit,
  onDelete,
}) {
  const { t } = useLanguage();
  const bottomRef =
    useRef(null);
  const longPressTimer = useRef(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);

  useEffect(() => () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const lastOwnMessage = [...messages].reverse().find((message) => (
    String(message.sender?.id ?? message.sender) === String(currentUser?.id)
  ));

  return (
    <div className="message-list">

      {messages.map((message) => {
        const mine =
          String(message.sender?.id ?? message.sender) ===
          String(currentUser?.id);

        const startLongPress = () => {
          if (!mine) return;
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
          longPressTimer.current = window.setTimeout(() => {
            longPressTimer.current = null;
            setLongPressedMessageId(message.id);
          }, 2000);
        };
        const cancelLongPress = () => {
          if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        };

        return (
          <div
            key={message.id}
            className={
              mine
                ? "message mine"
                : "message"
            }
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={(event) => {
              if (!mine) return;
              event.preventDefault();
            }}
          >
            <div className="message-bubble">
              {message.reply_to && (
                <blockquote className="message-reply-preview">
                  {message.reply_to.content}
                </blockquote>
              )}
              {message.is_deleted
                ? "This message was deleted."
                : (
                  <>
                    {message.content && <p>{message.content}</p>}
                    {message.attachment_type === "audio" && message.attachment && (
                      <audio controls preload="metadata" src={message.attachment}>
                        Audio playback is not supported by this browser.
                      </audio>
                    )}
                  </>
                )}
            </div>
            {message.edited_at && !message.is_deleted && (
              <small className="message-edited-label">Edited</small>
            )}
            {message.verification_warning && !mine && (
              <small className="message-verification-warning" role="alert">
                {t("unverifiedWarning")}
              </small>
            )}
            {mine && lastOwnMessage?.id === message.id && (
              <small className="message-receipt">
                {message.is_read ? "Seen" : "Sent"}
              </small>
            )}
            {!message.is_deleted && (
              <MessageActions
                message={message}
                own={mine}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                open={longPressedMessageId === message.id}
                onClose={() => setLongPressedMessageId(null)}
              />
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />

    </div>
  );
}