import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import messageService from "../services/messageService";
import useMessages from "../hooks/useMessages";
import useAuth from "../hooks/useAuth";
import ConversationList from "../components/messages/ConversationList";
import MessageList from "../components/messages/MessageList";
import MessageInput from "../components/messages/MessageInput";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import { getArrayResults } from "../utils/arrayResults";

export default function Messages() {
  const { user } = useAuth();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    messageService
      .conversations()
      .then((data) => {
        if (!active) return;
        const items = getArrayResults(data, "Conversations");
        setConversations(items);

        const requestedId = location.state?.conversationId;
        if (requestedId && items.some((item) => item.id === requestedId)) {
          setSelectedConversation(requestedId);
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
    connected,
    typingUser,
    error: messageError,
    sendMessage,
    sendTyping,
  } = useMessages(selectedConversation);

  const handleSend = (content) => {
    sendMessage(content);
    sendTyping(false);
  };
  const activeConversation = conversations.find(
    (conversation) => conversation.id === selectedConversation
  );
  const otherUser =
    activeConversation?.other_user ||
    activeConversation?.participants?.find(
      (participant) => String(participant.id) !== String(user?.id)
    );
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
    <div className="messages-page">
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversation}
        onSelect={setSelectedConversation}
        currentUser={user}
      />

      <main className="chat-window">
        {!selectedConversation ? (
          <div className="empty-state">
            <h2>Select a conversation</h2>
            <p>Choose a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="chat-status">
              {connected ? "Connected 🟢" : "Connecting... 🔴"}
            </div>
            {showVerificationWarning && (
              <p className="message-verification-warning" role="alert">
                This is not a verified member. Trust this member at your own risk.
              </p>
            )}

            {messageError ? (
              <ErrorState message={messageError} />
            ) : (
              <MessageList messages={messages} currentUser={user} />
            )}

            {typingUser && (
              <div className="typing-indicator">Typing...</div>
            )}

            <MessageInput
              onSend={handleSend}
              onTyping={sendTyping}
              disabled={!connected}
            />
          </>
        )}
      </main>
    </div>
  );
}