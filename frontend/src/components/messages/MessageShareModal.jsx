import { useEffect, useState } from "react";
import { Check, Search, Send, UsersRound } from "lucide-react";
import Avatar from "../common/Avatar";
import Modal from "../common/Modal";
import VerifiedBadge from "../common/VerifiedBadge";
import { useLanguage } from "../../context/LanguageContext";

function getDisplayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ")
    || user?.username
    || "";
}

function getConversationDetails(conversation, currentUser, t) {
  const isGroup = conversation.is_group
    || conversation.conversation_type === "group";
  const otherUser = conversation.other_user || conversation.participants?.find(
    (participant) => String(participant.id) !== String(currentUser?.id)
  );
  const name = isGroup
    ? conversation.name || t("groupConversation")
    : getDisplayName(otherUser) || t("conversation");
  return { isGroup, name, otherUser };
}

export default function MessageShareModal({
  open,
  onClose,
  message,
  conversations,
  currentUser,
  onSend,
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [sendingIds, setSendingIds] = useState(() => new Set());
  const [sentIds, setSentIds] = useState(() => new Set());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSendingIds(new Set());
    setSentIds(new Set());
    setErrors({});
  }, [message?.id, open]);

  const visibleConversations = conversations.filter((conversation) => {
    const { name } = getConversationDetails(conversation, currentUser, t);
    const usernames = (conversation.participants || [])
      .map((participant) => participant.username || "")
      .join(" ");
    return `${name} ${usernames}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  const sendToConversation = async (conversation) => {
    const id = String(conversation.id);
    if (sendingIds.has(id) || sentIds.has(id)) return;
    setSendingIds((current) => new Set(current).add(id));
    setErrors((current) => ({ ...current, [id]: "" }));
    try {
      await onSend(conversation, message);
      setSentIds((current) => new Set(current).add(id));
    } catch (sendError) {
      const detail = sendError.response?.data?.detail;
      setErrors((current) => ({
        ...current,
        [id]: typeof detail === "string" && detail
          ? detail
          : sendError.message || t("forwardMessageFailed"),
      }));
    } finally {
      setSendingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("shareMessageToChat")}>
      <div className="message-share-modal">
        <label className="message-share-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={t("searchConversations")}
            placeholder={t("searchConversations")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </label>
        <div className="message-share-list">
          {visibleConversations.map((conversation) => {
            const id = String(conversation.id);
            const { isGroup, name, otherUser } = getConversationDetails(
              conversation,
              currentUser,
              t
            );
            const groupMembers = (conversation.participants || [])
              .filter((participant) => String(participant.id) !== String(currentUser?.id))
              .slice(0, 2);
            const isSending = sendingIds.has(id);
            const isSent = sentIds.has(id);

            return (
              <div className="message-share-row" key={id}>
                {isGroup ? (
                  <span className="message-share-group-avatar" aria-hidden="true">
                    {groupMembers.length ? groupMembers.map((member) => (
                      <Avatar key={member.id} user={member} size="small" />
                    )) : <UsersRound size={20} />}
                  </span>
                ) : (
                  <Avatar user={otherUser} size="medium" />
                )}
                <span className="message-share-identity">
                  <strong>{name}</strong>
                  {!isGroup && <VerifiedBadge verified={otherUser?.is_verified} />}
                </span>
                <button
                  type="button"
                  className={`message-share-send${isSent ? " is-sent" : ""}`}
                  aria-label={isSent
                    ? t("messageSentTo", { name })
                    : t("sendToConversation", { name })}
                  disabled={isSending || isSent}
                  onClick={() => void sendToConversation(conversation)}
                >
                  {isSent ? (
                    <>
                      <Check size={16} aria-hidden="true" />
                      {t("sentWithCheck")}
                    </>
                  ) : isSending ? (
                    t("sending")
                  ) : (
                    <>
                      <Send size={15} aria-hidden="true" />
                      {t("send")}
                    </>
                  )}
                </button>
                {errors[id] && (
                  <small className="message-share-error" role="alert">
                    {errors[id]}
                  </small>
                )}
              </div>
            );
          })}
          {visibleConversations.length === 0 && (
            <p className="message-share-empty">
              {conversations.length ? t("noSearchResults") : t("noConversationsMatch")}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
