import Avatar from "../common/Avatar";
import { useLanguage } from "../../context/LanguageContext";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  currentUser,
  onCreateGroup,
}) {
  const { t } = useLanguage();
  return (
    <aside className="conversation-list">

      <div className="conversation-list-header">
        <h2>{t("messages")}</h2>
        <button type="button" onClick={onCreateGroup}>{t("newGroup")}</button>
      </div>

      {conversations.map((conversation) => {
        const isGroup = conversation.is_group
          || conversation.conversation_type === "group";
        const otherUser =
          conversation.other_user ||
          conversation.participants?.find(
            (participant) =>
              String(participant.id) !== String(currentUser?.id)
          );

        return (
          <button
            key={conversation.id}
            className={
              selectedId ===
              conversation.id
                ? "conversation active"
                : "conversation"
            }
            onClick={() =>
              onSelect(conversation.id)
            }
          >
            <Avatar
              user={isGroup ? null : otherUser}
              size="small"
            />

            <div className="conversation-details">
              <strong>{isGroup
                ? conversation.name || "Group conversation"
                : otherUser?.username || "Conversation"}</strong>
            </div>
          </button>
        );
      })}

    </aside>
  );
}