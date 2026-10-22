export default function TypingIndicator({
  username,
}) {
  if (!username) {
    return null;
  }

  return (
    <div className="typing-indicator">
      <span>
        {username} is typing
      </span>

      <span className="typing-dots">
        •••
      </span>
    </div>
  );
}