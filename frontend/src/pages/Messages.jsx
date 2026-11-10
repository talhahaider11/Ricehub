import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import CreateGroupModal from "../components/messages/CreateGroupModal";
import friendService from "../services/friendService";
import messageService from "../services/messageService";
import useMessages from "../hooks/useMessages";
import useAuth from "../hooks/useAuth";
import ConversationList from "../components/messages/ConversationList";
import MessageList from "../components/messages/MessageList";
import MessageInput from "../components/messages/MessageInput";
import AudioCallControls from "../components/messages/AudioCallControls";
import TypingIndicator from "../components/messages/TypingIndicator";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import { getArrayResults } from "../utils/arrayResults";
import GroupMemberModal from "../components/messages/GroupMemberModal";
import { useLanguage } from "../context/LanguageContext";

function formatLastSeen(lastSeen, now, t, language) {
  if (!lastSeen) return "";
  const lastSeenTime = new Date(lastSeen).getTime();
  if (!Number.isFinite(lastSeenTime)) return "";
  const minutes = Math.max(
    0,
    Math.floor((now - lastSeenTime) / 60_000)
  );
  if (minutes < 1) return t("lastSeenJustNow");
  if (minutes === 1) return t("lastSeenMinute");
  if (minutes < 60) {
    return t("lastSeenMinutes", {
      count: new Intl.NumberFormat(language).format(minutes),
    });
  }
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t("lastSeenHour");
  if (hours < 24) {
    return t("lastSeenHours", {
      count: new Intl.NumberFormat(language).format(hours),
    });
  }
  const days = Math.floor(hours / 24);
  return days === 1
    ? t("lastSeenDay")
    : t("lastSeenDays", {
      count: new Intl.NumberFormat(language).format(days),
    });
}

export default function Messages() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [lastSeenNow, setLastSeenNow] = useState(() => Date.now());
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [friendError, setFriendError] = useState("");
  const [openingFriend, setOpeningFriend] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setLastSeenNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    friendService.list()
      .then((data) => {
        if (!active) return;
        const friends = getArrayResults(data, "Friends");
        setOnlineFriends(friends.filter((friend) => friend.is_online === true));
        setFriendError("");
      })
      .catch((loadError) => {
        console.error("Online friends could not be loaded:", loadError);
        if (active) setFriendError(t("friendsLoadFailed"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    messageService
      .conversations()
      .then((data) => {
        if (!active) return;
        const items = getArrayResults(data, "Conversations");
        setConversations(items);

        const requestedId =
          location.state?.conversationId ||
          new URLSearchParams(location.search).get("conversation_id");
        if (
          requestedId &&
          items.some((item) => String(item.id) === String(requestedId))
        ) {
          setSelectedConversation(
            items.find((item) => String(item.id) === String(requestedId)).id
          );
        }

        const requestedUsername = new URLSearchParams(location.search).get("username");
        if (requestedUsername) {
          return messageService.createConversation(requestedUsername)
            .then((conversation) => {
              if (!active) return;
              setConversations((current) => [
                conversation,
                ...current.filter((item) => item.id !== conversation.id),
              ]);
              setSelectedConversation(conversation.id);
            });
        }
        setError("");
      })
      .catch((loadError) => {
        console.error("Conversations could not be loaded:", loadError);
        if (active) setError(t("conversationLoadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.search, location.state?.conversationId, t]);

  const {
    messages,
    setMessages,
    connected,
    typingUser,
    error: messageError,
    sendMessage,
    sendTyping,
    sendCallSignal,
    callSignal,
    clearCallSignal,
  } = useMessages(selectedConversation);

  const handleSend = (content, replyToId) => {
    sendMessage(content, replyToId);
    sendTyping(false);
  };
  const handleSendAttachment = async (file, replyToId, attachmentType) => {
    const message = await messageService.sendAttachment(
      selectedConversation,
      file,
      replyToId,
      attachmentType
    );
    setMessages((current) => (
      current.some((item) => item.id === message.id)
        ? current
        : [...current, message]
    ));
    setReplyTarget(null);
  };
  const handleGroupCreated = (conversation) => {
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
    setSelectedConversation(conversation.id);
    setGroupModalOpen(false);
  };
  const handleSelectFriend = async (friend) => {
    if (!friend?.username || openingFriend) return;
    const existing = conversations.find((conversation) => {
      if (conversation.is_group || conversation.conversation_type === "group") return false;
      const participant = conversation.other_user
        || conversation.participants?.find(
          (item) => String(item.id) !== String(user?.id)
        );
      return participant?.username === friend.username;
    });
    if (existing) {
      setSelectedConversation(existing.id);
      return;
    }

    setOpeningFriend(friend.username);
    setFriendError("");
    try {
      const conversation = await messageService.createConversation(friend.username);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => String(item.id) !== String(conversation.id)),
      ]);
      setSelectedConversation(conversation.id);
    } catch (openError) {
      console.error("Conversation with online friend could not be opened:", openError);
      setFriendError(t("conversationOpenFailed"));
    } finally {
      setOpeningFriend("");
    }
  };
  const handleEdit = async (message, content) => {
    const updated = await messageService.editMessage(message.id, content);
    setMessages((current) => current.map((item) => (
      item.id === message.id ? updated : item
    )));
  };
  const handleDelete = async (message) => {
    if (!window.confirm(t("confirmUnsend"))) return;
    await messageService.deleteMessage(message.id);
    setMessages((current) => current.map((item) => (
      item.id === message.id
        ? { ...item, content: "", is_deleted: true }
        : item
    )));
  };
  const handleConversationUpdated = (updated) => {
    setConversations((current) => current.map((conversation) => (
      conversation.id === updated.id ? updated : conversation
    )));
  };
  const activeConversation = conversations.find(
    (conversation) => conversation.id === selectedConversation
  );
  const otherUser =
    activeConversation?.other_user ||
    activeConversation?.participants?.find(
      (participant) => String(participant.id) !== String(user?.id)
    );
  useEffect(() => {
    if (!selectedConversation) return undefined;
    let active = true;
    const refreshPresence = () => {
      messageService.conversations()
        .then((data) => {
          if (!active) return;
          setConversations(getArrayResults(data, "Conversations"));
          setLastSeenNow(Date.now());
        })
        .catch((refreshError) => {
          console.error("Conversation presence could not be refreshed:", refreshError);
        });
    };
    const timer = window.setInterval(refreshPresence, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedConversation]);
  const showVerificationWarning = Boolean(
    user &&
      otherUser?.is_email_verified &&
      !user.is_email_verified
  );

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className={`messages-page${selectedConversation ? " has-selected-conversation" : ""}`}>
      {selectedConversation ? (
        <main className="chat-window">
          <>
            <header className="chat-header">
              <button
                className="chat-back-button"
                type="button"
                aria-label={t("backToConversations")}
                title={t("backToConversations")}
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
              <div className="chat-header-identity">
                <strong>
                  {activeConversation?.is_group
                    || activeConversation?.conversation_type === "group"
                    ? activeConversation.name || t("groupConversation")
                    : otherUser?.username || t("conversation")}
                </strong>
                {otherUser && (
                  <small className="chat-presence" aria-live="polite">
                    {otherUser.is_online === true ? (
                      <>
                        <span className="chat-presence-dot" aria-hidden="true" />
                        {t("active")}
                      </>
                    ) : (
                      formatLastSeen(otherUser.last_seen, lastSeenNow, t, language)
                    )}
                  </small>
                )}
              </div>
              {(activeConversation?.is_group
                || activeConversation?.conversation_type === "group") && (
                <button
                  type="button"
                  className="chat-add-member-button"
                  onClick={() => setMemberModalOpen(true)}
                >
                  {t("addMember")}
                </button>
              )}
              {activeConversation
                && !activeConversation.is_group
                && activeConversation.conversation_type !== "group"
                && otherUser && (
                  <AudioCallControls
                    peerId={otherUser.id}
                    disabled={!connected}
                    callSignal={callSignal}
                    sendCallSignal={sendCallSignal}
                    clearCallSignal={clearCallSignal}
                  />
                )}
            </header>
            {showVerificationWarning && (
              <p className="message-verification-warning" role="alert">
                {t("messageVerificationWarning")}
              </p>
            )}

            {messageError ? (
              <ErrorState message={messageError} />
            ) : (
              <MessageList
                messages={messages}
                currentUser={user}
                onReply={setReplyTarget}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}

            <TypingIndicator
              username={activeConversation?.participants?.find(
                (participant) => String(participant.id) === String(typingUser)
              )?.username}
            />

            <MessageInput
              onSend={handleSend}
              onSendAttachment={handleSendAttachment}
              onTyping={sendTyping}
              disabled={!connected}
              replyTarget={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
            />
          </>
        </main>
      ) : (
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
          currentUser={user}
          onCreateGroup={() => setGroupModalOpen(true)}
          onlineFriends={onlineFriends}
          onSelectFriend={handleSelectFriend}
          openingFriend={openingFriend}
          friendError={friendError}
        />
      )}
      <CreateGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreated={handleGroupCreated}
      />
      <GroupMemberModal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        conversation={activeConversation}
        currentUser={user}
        onUpdated={(conversation) => {
          setConversations((current) => current.map((item) => (
            item.id === conversation.id ? conversation : item
          )));
          setMemberModalOpen(false);
        }}
      />
    </div>
  );
}