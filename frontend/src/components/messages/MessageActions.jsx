import { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function MessageActions({
  message,
  own,
  onReply,
  onEdit,
  onDelete,
  open = false,
  onClose,
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content || "");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const actionsRef = useRef(null);

  useEffect(() => {
    setMenuOpen(open);
  }, [open]);

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
      setError(t("messageEmpty"));
      return;
    }
    try {
      await onEdit(message, updatedContent);
      setEditing(false);
      setError("");
    } catch (saveError) {
      setError(saveError.message || t("messageEditFailed"));
    }
  };

  const remove = async () => {
    try {
      await onDelete(message);
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || t("messageUnsendFailed"));
    }
  };

  const shareMessage = async () => {
    const url = message.attachment || undefined;
    const text = message.content || "";
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText([text, url].filter(Boolean).join("\n"));
        setShareNotice(t("copied"));
      } else {
        throw new Error(t("shareUnavailable"));
      }
      closeMenu();
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setError(shareError.message || t("shareUnavailable"));
      }
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
      {!editing && (
        <button
          className="message-actions-trigger"
          type="button"
          aria-label={t("messageOptions")}
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
          aria-label={t("messageOptions")}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onReply(message);
            }}
          >
            {t("reply")}
          </button>
          {own && (
            <>
              <button type="button" role="menuitem" onClick={startEditing}>
                {t("edit")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  void remove();
                }}
              >
                {t("unsend")}
              </button>
            </>
          )}
          <button type="button" role="menuitem" onClick={() => void shareMessage()}>
            {t("share")}
          </button>
        </div>
      )}
      {editing && (
        <form className="message-edit-form" onSubmit={save}>
          <input
            aria-label={t("editMessage")}
            maxLength={5000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button type="submit">{t("save")}</button>
          <button type="button" onClick={() => setEditing(false)}>{t("cancel")}</button>
          {error && <span className="error" role="alert">{error}</span>}
        </form>
      )}
      {shareNotice && <span className="message-share-notice" role="status">{shareNotice}</span>}
      {error && !editing && <span className="error" role="alert">{error}</span>}
    </div>
  );
}
