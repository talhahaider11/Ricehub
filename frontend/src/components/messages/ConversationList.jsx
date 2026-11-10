import Avatar from "../common/Avatar";
import { useLanguage } from "../../context/LanguageContext";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  currentUser,
  onCreateGroup,
  onlineFriends = [],
  onSelectFriend,
  openingFriend,
  friendError,
}) {
  const { t } = useLanguage();
  return (
    <aside className="conversation-list">

      <div className="conversation-list-header">
        <h2>{t("messages")}</h2>
        <button type="button" onClick={onCreateGroup}>{t("newGroup")}</button>
      </div>

      <section className="online-friends" aria-labelledby="online-friends-heading">
        <h3 id="online-friends-heading">{t("onlineFriends")}</h3>
        {friendError && <p className="online-friends-error" role="alert">{friendError}</p>}
        {!friendError && onlineFriends.length === 0 && (
          <p className="online-friends-empty">{t("noFriendsOnline")}</p>
        )}
        {onlineFriends.length > 0 && (
          <div className="online-friends-list">
            {onlineFriends.map((friend) => (
              <button
                type="button"
                className="online-friend"
                key={friend.id}
                aria-label={t("startChatWith", { username: friend.username })}
                disabled={Boolean(openingFriend)}
                onClick={() => onSelectFriend(friend)}
              >
                <span className="online-friend-avatar">
                  <Avatar user={friend} size="small" />
                  <span className="online-friend-dot" aria-hidden="true" />
                </span>
                <span className="online-friend-name">
                  {friend.first_name || friend.username}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

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