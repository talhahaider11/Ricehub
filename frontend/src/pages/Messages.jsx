import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, UsersRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import CreateGroupModal from "../components/messages/CreateGroupModal";
import friendService from "../services/friendService";
import messageService from "../services/messageService";
import useMessages from "../hooks/useMessages";
import useAuth from "../hooks/useAuth";
import ConversationList from "../components/messages/ConversationList";
import MessageList from "../components/messages/MessageList";
import MessageInput from "../components/messages/MessageInput";
import MessageShareModal from "../components/messages/MessageShareModal";
import AudioCallControls from "../components/messages/AudioCallControls";
import TypingIndicator from "../components/messages/TypingIndicator";
import Loader from "../components/common/Loader";
import ErrorState from "../components/common/ErrorState";
import { getArrayResults } from "../utils/arrayResults";
import GroupMemberModal from "../components/messages/GroupMemberModal";
import { useLanguage } from "../context/LanguageContext";
import { useChatUploads } from "../context/ChatUploadContext";
import Avatar from "../components/common/Avatar";

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
  const { uploads, queueVideoUpload } = useChatUploads();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [messageToShare, setMessageToShare] = useState(null);
  const [lastSeenNow, setLastSeenNow] = useState(() => Date.now());
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendError, setFriendError] = useState("");
  const [openingFriend, setOpeningFriend] = useState("");
  const [conversationActionError, setConversationActionError] = useState("");

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
        setFriends(friends);
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
    messageService.conversations({ archived: true })
      .then((data) => {
        if (!active) return;
        setArchivedConversations(getArrayResults(data, "Archived conversations"));
      })
      .catch((archiveLoadError) => {
        console.error("Archived conversations could not be loaded:", archiveLoadError);
        if (active) setConversationActionError(t("conversationLoadFailed"));
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
    conversationHidden,
  } = useMessages(selectedConversation);

  const visibleMessages = useMemo(() => {
    const optimisticVideos = uploads
      .filter((upload) => (
        String(upload.conversationId) === String(selectedConversation)
        && String(upload.userId) === String(user?.id)
      ))
      .map((upload) => ({
        id: upload.id,
        sender: { id: user.id },
        attachment: upload.previewUrl,
        attachment_type: "video",
        original_filename: upload.fileName,
        created_at: upload.createdAt,
        upload_status: upload.status,
        is_read: false,
      }));

    return [...messages, ...optimisticVideos].sort((left, right) => (
      Date.parse(left.created_at || "") - Date.parse(right.created_at || "")
    ));
  }, [messages, selectedConversation, uploads, user?.id]);
  const shareableConversations = useMemo(() => {
    const conversationsById = new Map();
    [...conversations, ...archivedConversations].forEach((conversation) => {
      conversationsById.set(String(conversation.id), conversation);
    });
    return [...conversationsById.values()];
  }, [archivedConversations, conversations]);

  const handleSend = async (content, replyToId) => {
    try {
      await sendMessage(content, replyToId);
    } finally {
      sendTyping(false);
    }
  };
  const handleSendAttachment = async (file, replyToId, attachmentType) => {
    if (attachmentType === "video") {
      await queueVideoUpload({
        conversationId: selectedConversation,
        file,
        replyToId,
        attachmentType,
      });
      setReplyTarget(null);
      return;
    }

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
    const existing = [...conversations, ...archivedConversations].find((conversation) => {
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
  const handleForwardMessage = async (conversation, message) => {
    const content = [message.content?.trim(), message.attachment]
      .filter(Boolean)
      .join("\n");
    if (!content) throw new Error(t("forwardMessageFailed"));

    const forwardedMessage = await messageService.sendText(conversation.id, content);
    const updateConversation = (item) => String(item.id) === String(conversation.id)
      ? {
        ...item,
        last_message: forwardedMessage,
        updated_at: forwardedMessage.created_at || new Date().toISOString(),
      }
      : item;
    setConversations((current) => current.map(updateConversation));
    setArchivedConversations((current) => current.map(updateConversation));
  };
  const handleArchiveConversation = async (conversation, isArchived) => {
    setConversationActionError("");
    try {
      const updated = await messageService.archiveConversation(
        conversation.id,
        isArchived
      );
      if (isArchived) {
        setConversations((current) => current.filter((item) => item.id !== conversation.id));
        setArchivedConversations((current) => [
          updated,
          ...current.filter((item) => item.id !== conversation.id),
        ]);
      } else {
        setArchivedConversations((current) => current.filter((item) => item.id !== conversation.id));
        setConversations((current) => [
          updated,
          ...current.filter((item) => item.id !== conversation.id),
        ]);
      }
    } catch (actionError) {
      console.error("Conversation archive state could not be updated:", actionError);
      setConversationActionError(t("conversationActionFailed"));
    }
  };
  const handleDeleteConversation = async (conversation) => {
    if (!window.confirm(t("confirmDeleteConversation"))) return;
    setConversationActionError("");
    try {
      await messageService.deleteConversation(conversation.id);
      setConversations((current) => current.filter((item) => item.id !== conversation.id));
      setArchivedConversations((current) => current.filter((item) => item.id !== conversation.id));
    } catch (actionError) {
      console.error("Conversation could not be deleted:", actionError);
      setConversationActionError(t("conversationActionFailed"));
    }
  };
  const handleLeaveGroup = async () => {
    await messageService.leaveGroup(selectedConversation);
    setConversations((current) => current.filter(
      (conversation) => conversation.id !== selectedConversation
    ));
    setArchivedConversations((current) => current.filter(
      (conversation) => conversation.id !== selectedConversation
    ));
    setSelectedConversation(null);
    setMemberModalOpen(false);
  };
  const handleShowArchived = async () => {
    setConversationActionError("");
    try {
      const data = await messageService.conversations({ archived: true });
      setArchivedConversations(getArrayResults(data, "Archived conversations"));
      setShowArchived(true);
    } catch (archiveLoadError) {
      console.error("Archived conversations could not be loaded:", archiveLoadError);
      setConversationActionError(t("conversationLoadFailed"));
    }
  };
  useEffect(() => {
    if (!conversationHidden) return;
    setConversations((current) => current.filter(
      (conversation) => conversation.id !== selectedConversation
    ));
    setArchivedConversations((current) => current.filter(
      (conversation) => conversation.id !== selectedConversation
    ));
    setSelectedConversation(null);
  }, [conversationHidden, selectedConversation]);
  const activeConversation = [...conversations, ...archivedConversations].find(
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
      messageService.conversations({ archived: showArchived })
        .then((data) => {
          if (!active) return;
          const items = getArrayResults(data, "Conversations");
          if (showArchived) {
            setArchivedConversations(items);
          } else {
            setConversations(items);
          }
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
  }, [selectedConversation, showArchived]);
  const isDirectConversation = Boolean(
    activeConversation
    && !activeConversation.is_group
    && activeConversation.conversation_type !== "group"
  );
  const isGroupConversation = Boolean(
    activeConversation?.is_group
    || activeConversation?.conversation_type === "group"
  );
  const isGroupAdmin = Boolean(activeConversation?.memberships?.some(
    (membership) => String(membership.user?.id) === String(user?.id)
      && membership.role === "admin"
  ));
  const membersCannotSend = Boolean(
    isGroupConversation && activeConversation?.admins_only && !isGroupAdmin
  );
  const activeMemberCount = Number(activeConversation?.member_count)
    || activeConversation?.participants?.length
    || 0;
  const showVerificationWarning = Boolean(
    isDirectConversation && otherUser?.is_verified === false
  );
  const loadedLastMessage = visibleMessages[visibleMessages.length - 1];
  const loadedLastMessageTime = Date.parse(loadedLastMessage?.created_at || "");
  const listedLastMessage = activeConversation?.last_message;
  const listedLastMessageTime = Date.parse(listedLastMessage?.created_at || "");
  const latestConversationMessageId = loadedLastMessage
    && (
      !listedLastMessage
      || (
        Number.isFinite(loadedLastMessageTime)
        && (
          !Number.isFinite(listedLastMessageTime)
          || loadedLastMessageTime >= listedLastMessageTime
        )
      )
    )
    ? loadedLastMessage.id
    : listedLastMessage?.id;

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
              <span className="chat-header-avatar">
                {activeConversation?.is_group
                  || activeConversation?.conversation_type === "group" ? (
                    <span className="chat-group-avatar">
                      <UsersRound size={20} aria-hidden="true" />
                    </span>
                  ) : (
                    <>
                      <Avatar user={otherUser} size="medium" />
                      {otherUser?.is_online === true && (
                        <span className="chat-header-online-dot" aria-hidden="true" />
                      )}
                    </>
                  )}
              </span>
              <div className="chat-header-identity">
                <strong>
                  {activeConversation?.is_group
                    || activeConversation?.conversation_type === "group"
                    ? activeConversation.name || t("groupConversation")
                    : [otherUser?.first_name, otherUser?.last_name]
                      .filter(Boolean)
                      .join(" ") || otherUser?.username || t("conversation")}
                </strong>
                {otherUser && (
                  <small className="chat-presence" aria-live="polite">
                    {otherUser.is_online === true ? (
                      <>
                        <span className="chat-presence-dot" aria-hidden="true" />
                        {t("activeNow")}
                      </>
                    ) : (
                      formatLastSeen(otherUser.last_seen, lastSeenNow, t, language)
                    )}
                  </small>
                )}
              </div>
              {isGroupConversation && (
                <button
                  type="button"
                  className="chat-add-member-button"
                  aria-label={t("groupMembersCount", {
                    count: new Intl.NumberFormat(language).format(activeMemberCount),
                  })}
                  onClick={() => setMemberModalOpen(true)}
                >
                  <UsersRound size={17} aria-hidden="true" />
                  <span>
                    {t("groupMembersCount", {
                      count: new Intl.NumberFormat(language).format(activeMemberCount),
                    })}
                  </span>
                </button>
              )}
              {activeConversation
                && !activeConversation.is_group
                && activeConversation.conversation_type !== "group"
                && otherUser && (
                  <AudioCallControls
                    peerId={otherUser.id}
                    peer={otherUser}
                    currentUser={user}
                    disabled={!connected}
                    callSignal={callSignal}
                    sendCallSignal={sendCallSignal}
                    clearCallSignal={clearCallSignal}
                  />
                )}
            </header>

            {messageError && (
              <p className="message-connection-banner" role="alert">
                {messageError}
              </p>
            )}
            {membersCannotSend && (
              <p className="message-connection-banner group-admins-only-notice" role="status">
                {t("adminsOnlyMessages")}
              </p>
            )}
            <MessageList
              messages={visibleMessages}
              currentUser={user}
              onReply={setReplyTarget}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShare={setMessageToShare}
              conversationPartner={isDirectConversation ? otherUser : null}
              showVerificationWarning={showVerificationWarning}
              latestConversationMessageId={latestConversationMessageId}
            />

            <TypingIndicator
              username={activeConversation?.participants?.find(
                (participant) => String(participant.id) === String(typingUser)
              )?.username}
            />

            <MessageInput
              onSend={handleSend}
              onSendAttachment={handleSendAttachment}
              onTyping={sendTyping}
              disabled={!selectedConversation || membersCannotSend}
              replyTarget={replyTarget}
              onCancelReply={() => setReplyTarget(null)}
            />
          </>
        </main>
      ) : (
        <ConversationList
          conversations={showArchived ? archivedConversations : conversations}
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
          currentUser={user}
          onCreateGroup={() => setGroupModalOpen(true)}
          onlineFriends={onlineFriends}
          friends={friends}
          onSelectFriend={handleSelectFriend}
          openingFriend={openingFriend}
          friendError={friendError}
          actionError={conversationActionError}
          archived={showArchived}
          archiveCount={archivedConversations.length}
          onShowArchived={handleShowArchived}
          onBack={() => {
            if (showArchived) {
              setShowArchived(false);
            } else {
              navigate(-1);
            }
          }}
          onArchive={handleArchiveConversation}
          onDelete={handleDeleteConversation}
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
          setArchivedConversations((current) => current.map((item) => (
            item.id === conversation.id ? conversation : item
          )));
        }}
        onLeave={handleLeaveGroup}
      />
      <MessageShareModal
        open={Boolean(messageToShare)}
        onClose={() => setMessageToShare(null)}
        message={messageToShare}
        conversations={shareableConversations}
        currentUser={user}
        onSend={handleForwardMessage}
      />
    </div>
  );
}