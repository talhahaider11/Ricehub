import { useState } from "react";

export default function MessageInput({
  onSend,
  onTyping,
  disabled = false,
}) {
  const [message, setMessage] =
    useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const content = message.trim();
    if (!content || disabled || sending) {
      return;
    }

    try {
      setSending(true);
      setError("");
      await onSend(content);
      setMessage("");
      onTyping?.(false);
    } catch (sendError) {
      setError(sendError.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="message-input"
      onSubmit={submit}
    >
      <input
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          onTyping?.(Boolean(event.target.value.trim()));
        }}
        placeholder="Write a message..."
        maxLength={5000}
        disabled={disabled || sending}
        aria-label="Write a message"
      />

      <button type="submit" disabled={disabled || sending || !message.trim()}>
        {sending ? "Sending..." : "Send"}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </form>
  );
}
