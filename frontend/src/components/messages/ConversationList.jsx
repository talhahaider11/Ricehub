import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  MoreHorizontal,
  Search,
  Settings,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import Avatar from "../common/Avatar";
import { useLanguage } from "../../context/LanguageContext";

function getName(user) {
  return (
    [user?.first_name, user?.last_name].filter(Boolean).join(" ")
    || user?.username
    || ""
  );
}

function getConversationName(conversation, currentUser, t) {
  if (conversation.is_group || conversation.conversation_type === "group") {
    return conversation.name || t("groupConversation");
  }
  const otherUser = conversation.other_user || conversation.participants?.find(
    (participant) => String(participant.id) !== String(currentUser?.id)
  );
  return getName(otherUser) || t("conversation");
}

function getPreview(conversation, currentUser, t) {
  const message = conversation.last_message;
  if (!message) return t("noMessagesYet");
  if (message.is_deleted) return t("messageDeleted");
  const own = String(message.sender?.id ?? message.sender) === String(currentUser?.id);
  const attachmentLabels = {
    image: own ? t("youSentPhoto") : t("sentPhoto"),
    video: own ? t("youSentVideo") : t("sentVideo"),
    audio: own ? t("youSentVoice") : t("sentVoice"),
    file: own ? t("youSentFile") : t("sentFile"),
  };
  if (message.attachment) {
    return attachmentLabels[message.attachment_type]
      || (own ? t("youSentFile") : t("sentFile"));
  }
  const content = message.content || "";
  return own ? `${t("youLabel")}: ${content}` : content;
}

function formatConversationDate(value, language, t) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return t("today");
  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
  }).format(date);
}

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
  archived = false,
  archiveCount = 0,
  onShowArchived,
  onBack,
  onArchive,
  onDelete,
  actionError,
}) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("inbox");
  const [actionId, setActionId] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  const pressPosition = useRef(null);

  useEffect(() => () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  }, []);

  const visibleConversations = conversations.filter((conversation) => {
    const isGroup = conversation.is_group
      || conversation.conversation_type === "group";
    if (!archived && filter === "unread" && !conversation.unread_count) return false;
    if (!archived && filter === "groups" && !isGroup) return false;
    const name = getConversationName(conversation, currentUser, t).toLowerCase();
    const usernames = (conversation.participants || [])
      .map((participant) => participant.username || "")
      .join(" ")
      .toLowerCase();
    return `${name} ${usernames}`.includes(query.trim().toLowerCase());
  });

  const stopLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (event, conversationId) => {
    if (event.pointerType === "mouse") return;
    stopLongPress();
    longPressFired.current = false;
    pressPosition.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressFired.current = true;
      window.navigator.vibrate?.(30);
      setActionId(conversationId);
    }, 2000);
  };

  const moveLongPress = (event) => {
    if (!pressPosition.current) return;
    const moved = Math.hypot(
      event.clientX - pressPosition.current.x,
      event.clientY - pressPosition.current.y
    );
    if (moved > 12) {
      pressPosition.current = null;
      stopLongPress();
    }
  };

  const selectConversation = (conversationId) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    setActionId(null);
    onSelect(conversationId);
  };

  return (
    <aside className={`conversation-list${archived ? " is-archived-view" : ""}`}>
      <header className="conversation-list-header">
        {archived ? (
          <button
            type="button"
            className="inbox-back-button"
            aria-label={t("backToInbox")}
            onClick={onBack}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="inbox-back-button"
            aria-label={t("back")}
            onClick={onBack}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <h1>{archived ? t("archivedChats") : t("chats")}</h1>
        <div className="inbox-header-actions">
          {!archived && (
            <button
              type="button"
              aria-label={t("newGroup")}
              title={t("newGroup")}
              onClick={onCreateGroup}
            >
              <UsersRound size={19} aria-hidden="true" />
            </button>
          )}
          <Link
            to="/settings"
            className="inbox-settings-link"
            aria-label={t("settingsPrivacy")}
            title={t("settingsPrivacy")}
          >
            <Settings size={19} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {actionError && (
        <p className="conversation-action-error" role="alert">{actionError}</p>
      )}

      {!archived && (
        <label className="conversation-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={t("searchConversations")}
            placeholder={t("searchConversations")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}

      {!archived && (
        <section className="online-friends" aria-labelledby="online-friends-heading">
          <h2 id="online-friends-heading">{t("activeNow")}</h2>
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
                    <Avatar user={friend} size="medium" />
                    <span className="online-friend-dot" aria-hidden="true" />
                  </span>
                  <span className="online-friend-name">{getName(friend)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {!archived && (
        <nav className="conversation-filters" aria-label={t("chatFilters")}>
          {[
            ["inbox", t("inbox")],
            ["unread", t("unread")],
            ["groups", t("groups")],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {!archived && (
        <button
          type="button"
          className="archived-chats-banner"
          onClick={onShowArchived}
        >
          <span className="archived-chats-icon">
            <Archive size={19} aria-hidden="true" />
          </span>
          <span>{t("archivedChats")}</span>
          <span className="archived-chats-count">{archiveCount}</span>
        </button>
      )}

      {archived && (
        <p className="archived-chats-description">{t("archivedChatsDescription")}</p>
      )}

      <div className="conversation-items">
        {visibleConversations.map((conversation) => {
          const isGroup = conversation.is_group
            || conversation.conversation_type === "group";
          const otherUser = conversation.other_user || conversation.participants?.find(
            (participant) => String(participant.id) !== String(currentUser?.id)
          );
          const title = getConversationName(conversation, currentUser, t);
          const groupMembers = (conversation.participants || [])
            .filter((participant) => String(participant.id) !== String(currentUser?.id))
            .slice(0, 2);
          const unread = Number(conversation.unread_count) || 0;

          return (
            <div
              key={conversation.id}
              className={[
                "conversation-row",
                selectedId === conversation.id ? "active" : "",
                actionId === conversation.id ? "is-action-selected" : "",
              ].filter(Boolean).join(" ")}
              onPointerDown={(event) => startLongPress(event, conversation.id)}
              onPointerUp={stopLongPress}
              onPointerLeave={stopLongPress}
              onPointerCancel={stopLongPress}
              onPointerMove={moveLongPress}
            >
              <button
                type="button"
                className="conversation"
                aria-label={t("openConversation", { name: title })}
                onClick={() => selectConversation(conversation.id)}
              >
                {isGroup ? (
                  <span className="conversation-avatar-stack" aria-hidden="true">
                    {groupMembers.length ? groupMembers.map((member) => (
                      <Avatar key={member.id} user={member} size="medium" />
                    )) : <UsersRound size={22} aria-hidden="true" />}
                    {unread > 0 && <span className="conversation-unread-dot" aria-hidden="true" />}
                  </span>
                ) : (
                  <span className="conversation-avatar">
                    <Avatar user={otherUser} size="medium" />
                    {otherUser?.is_online === true && (
                      <span className="conversation-online-dot" aria-hidden="true" />
                    )}
                    {unread > 0 && <span className="conversation-unread-dot" aria-hidden="true" />}
                  </span>
                )}
                <span className="conversation-details">
                  <span className="conversation-title-row">
                    <strong>{title}</strong>
                  </span>
                  <span className="conversation-preview-row">
                    <span className="conversation-preview">
                      {getPreview(conversation, currentUser, t)}
                      <small className="conversation-preview-date">
                        {" "}•{" "}
                        {formatConversationDate(
                          conversation.last_message?.created_at || conversation.updated_at,
                          language,
                          t
                        )}
                      </small>
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="conversation-actions-trigger"
                aria-label={t("conversationOptions", { name: title })}
                aria-haspopup="menu"
                aria-expanded={actionId === conversation.id}
                onClick={() => setActionId(
                  actionId === conversation.id ? null : conversation.id
                )}
              >
                <MoreHorizontal size={19} aria-hidden="true" />
              </button>
              {actionId === conversation.id && (
                <div className="conversation-actions-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionId(null);
                      onArchive(conversation, !archived);
                    }}
                  >
                    {archived ? <Check size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
                    {archived ? t("unarchive") : t("archive")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionId(null);
                      onDelete(conversation);
                    }}
                  >
                    {t("deleteConversation")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visibleConversations.length === 0 && (
          <p className="conversation-list-empty">
            {archived ? t("noArchivedChats") : t("noConversationsMatch")}
          </p>
        )}
      </div>
    </aside>
  );
}
