import Avatar from "../common/Avatar";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  currentUser,
}) {
  return (
    <aside className="conversation-list">

      <h2>Messages</h2>

      {conversations.map((conversation) => {
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
              user={otherUser}
              size="small"
            />

            <div>
              <strong>
                {
                  otherUser?.username || "Conversation"
                }
              </strong>

              <small>
                {
                  conversation
                    .last_message
                    ?.content
                }
              </small>
            </div>
          </button>
        );
      })}

    </aside>
  );
}