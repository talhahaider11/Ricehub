import {
  useEffect,
  useRef,
} from "react";

export default function MessageList({
  messages,
  currentUser,
}) {
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
              {message.content}
            </div>
            {message.verification_warning && (
              <small className="message-verification-warning" role="alert">
                This is not a verified member. Trust this member at your own risk.
              </small>
            )}
            {mine && (
              <small className="message-receipt">
                {message.is_read ? "Seen" : "Sent"}
              </small>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />

    </div>
  );
}