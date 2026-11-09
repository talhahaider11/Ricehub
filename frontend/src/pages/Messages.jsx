import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import CreateGroupModal from "../components/messages/CreateGroupModal";
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

function formatLastSeen(lastSeen, now) {
  if (!lastSeen) return "";
  const lastSeenTime = new Date(lastSeen).getTime();
  if (!Number.isFinite(lastSeenTime)) return "";
  const minutes = Math.max(
    0,
    Math.floor((now - lastSeenTime) / 60_000)
  );
  if (minutes < 1) return "Last seen just now";
  if (minutes === 1) return "Last seen 1 min ago";
  if (minutes < 60) return `Last seen ${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Last seen 1 hour ago";
  if (hours < 24) return `Last seen ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Last seen 1 day ago" : `Last seen ${days} days ago`;
}

export default function Messages() {
  const { user } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [lastSeenNow, setLastSeenNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setLastSeenNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
        if (active) setError("Conversations could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.search, location.state?.conversationId]);

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
  const handleSendAttachment = async (file, replyToId) => {
    const message = await messageService.sendAttachment(
      selectedConversation,
      file,
      replyToId
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
  const handleEdit = async (message, content) => {
    const updated = await messageService.editMessage(message.id, content);
    setMessages((current) => current.map((item) => (
      item.id === message.id ? updated : item
    )));
  };
  const handleDelete = async (message) => {
    if (!window.confirm("Delete this message?")) return;
    await messageService.deleteMessage(message.id);
    setMessages((current) => current.map((item) => (
      item.id === message.id
        ? { ...item, content: "", is_deleted: true }
        : item
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
                aria-label="Back to conversations"
                title="Back to conversations"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
              <div className="chat-header-identity">
                <strong>
                  {activeConversation?.is_group
                    || activeConversation?.conversation_type === "group"
                    ? activeConversation.name || "Group conversation"
                    : otherUser?.username || "Conversation"}
                </strong>
                {otherUser && (
                  <small className="chat-presence" aria-live="polite">
                    {otherUser.is_online === true ? (
                      <>
                        <span className="chat-presence-dot" aria-hidden="true" />
                        Active
                      </>
                    ) : (
                      formatLastSeen(otherUser.last_seen, lastSeenNow)
                    )}
                  </small>
                )}
              </div>
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
                This is not a verified member. Trust this member at your own risk.
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
        />
      )}
      <CreateGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}