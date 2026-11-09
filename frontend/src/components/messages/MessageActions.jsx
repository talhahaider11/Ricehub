import { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export default function MessageActions({
  message,
  own,
  onReply,
  onEdit,
  onDelete,
  open = false,
  onClose,
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content || "");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (own) setMenuOpen(open);
  }, [open, own]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!actionsRef.current?.contains(event.target)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

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
    closeMenu();
    setError("");
  };

  if (message.is_deleted) return null;

  return (
    <div className="message-actions" ref={actionsRef}>
      {!editing && !own && (
        <button
          className="message-actions-trigger"
          type="button"
          aria-label="Message options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={`message-options-${message.id}`}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      )}
      {!editing && menuOpen && (
        <div
          className="message-actions-menu"
          id={`message-options-${message.id}`}
          role="menu"
          aria-label="Message options"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onReply(message);
            }}
          >
            Reply
          </button>
          {own && (
            <>
              <button type="button" role="menuitem" onClick={startEditing}>
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  void remove();
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
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
