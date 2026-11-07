import {
  useEffect,
  useRef,
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="message-list">

      {messages.map((message) => {
        const mine =
          String(message.sender?.id ?? message.sender) ===
          String(currentUser?.id);

        return (
          <div
            key={message.id}
            className={
              mine
                ? "message mine"
                : "message"
            }
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
            {mine && (
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
              />
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />

    </div>
  );
}