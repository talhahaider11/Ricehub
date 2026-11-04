import { useState } from "react";

export default function MessageActions({
  message,
  own,
  onReply,
  onEdit,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content || "");
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    const updatedContent = content.trim();
    if (!updatedContent) {
      setError("Message cannot be empty.");
      return;
    }
    try {
      await onEdit(message, updatedContent);
      setEditing(false);
      setError("");
    } catch (saveError) {
      setError(saveError.message || "Message could not be edited.");
    }
  };

  const remove = async () => {
    try {
      await onDelete(message);
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "Message could not be deleted.");
    }
  };

  const startEditing = () => {
    setContent(message.content || "");
    setEditing(true);
    setError("");
  };

  if (message.is_deleted) return null;

  return (
    <div className="message-actions">
      <button type="button" onClick={() => onReply(message)}>Reply</button>
      {own && !editing && (
        <>
          <button type="button" onClick={startEditing}>Edit</button>
          <button type="button" onClick={remove}>Delete</button>
        </>
      )}
      {editing && (
        <form className="message-edit-form" onSubmit={save}>
          <input
            aria-label="Edit message"
            maxLength={5000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          {error && <span className="error" role="alert">{error}</span>}
        </form>
      )}
    </div>
  );
}
