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