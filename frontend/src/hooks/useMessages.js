import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import messageService from "../services/messageService";
import {
  cacheMessages,
  getCachedMessages,
} from "../services/messageCache";
import useAuth from "./useAuth";
import { getArrayResults } from "../utils/arrayResults";

const MAX_RECONNECT_ATTEMPTS = 5;

function mergeMessages(loadedMessages, currentMessages) {
  const messagesById = new Map();
  for (const message of loadedMessages) {
    messagesById.set(String(message.id), message);
  }
  for (const message of currentMessages) {
    messagesById.set(String(message.id), message);
  }
  return [...messagesById.values()].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || "");
    const rightTime = Date.parse(right.created_at || "");
    return Number.isFinite(leftTime) && Number.isFinite(rightTime)
      ? leftTime - rightTime
      : 0;
  });
}

export default function useMessages(conversationId) {
  const { user } = useAuth();
  const cachedHistory = getCachedMessages(conversationId, user?.id);
  const socketRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  const [messagesConversationId, setMessagesConversationId] = useState(conversationId);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const messagesRef = useRef(cachedHistory?.messages || []);
  const olderPageRef = useRef(cachedHistory?.nextPage || 2);
  const olderRequestRef = useRef(false);

  const [messages, setMessages] = useState(cachedHistory?.messages || []);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(!cachedHistory);
  const [hasOlderMessages, setHasOlderMessages] = useState(
    Boolean(cachedHistory?.hasOlderMessages)
  );
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [callSignals, setCallSignals] = useState([]);
  const [conversationHidden, setConversationHidden] = useState(false);
  const [error, setError] = useState("");
  conversationIdRef.current = conversationId;
  messagesRef.current = messages;

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const requestConversationId = conversationId;
    const isCurrentConversation = () => (
      isMountedRef.current
      && String(conversationIdRef.current) === String(requestConversationId)
    );
    try {
      if (!messagesRef.current.length) setLoading(true);
      setError("");
      const cachedHistory = getCachedMessages(requestConversationId, user?.id);
      const hasCachedMessages = Boolean(cachedHistory?.messages?.length);
      const cachedLatestId = hasCachedMessages
        ? cachedHistory.messages[cachedHistory.messages.length - 1].id
        : null;
      const data = cachedLatestId == null
        ? await messageService.messages(conversationId)
        : await messageService.messagesSince(conversationId, cachedLatestId);
      if (isCurrentConversation()) {
        const loadedMessages = getArrayResults(data, "Messages").reverse();
        if (loadedMessages.length) {
          setMessages((current) => mergeMessages(loadedMessages, current));
        }
        if (cachedLatestId == null) {
          setHasOlderMessages(Boolean(data.next));
          olderPageRef.current = data.next ? 2 : 1;
        }
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "read" }));
        }
      }
    } catch (loadError) {
      console.error("Messages could not be loaded:", loadError);
      if (isCurrentConversation() && !messagesRef.current.length) {
        setError("Messages could not be loaded.");
      }
    } finally {
      if (isCurrentConversation()) setLoading(false);
    }
  }, [conversationId, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !conversationId
      || !hasOlderMessages
      || olderRequestRef.current
    ) return false;
    olderRequestRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await messageService.messages(
        conversationId,
        olderPageRef.current
      );
      if (String(conversationIdRef.current) !== String(conversationId)) {
        return false;
      }
      const olderMessages = getArrayResults(data, "Messages").reverse();
      setMessages((current) => mergeMessages(olderMessages, current));
      setHasOlderMessages(Boolean(data.next));
      olderPageRef.current += 1;
      return olderMessages.length > 0;
    } catch (loadError) {
      console.error("Older messages could not be loaded:", loadError);
      setError("Older messages could not be loaded.");
      return false;
    } finally {
      olderRequestRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, hasOlderMessages]);

  useEffect(() => {
    let active = true;
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    setMessagesConversationId(conversationId);
    const cached = getCachedMessages(conversationId, user?.id);
    setMessages(cached?.messages || []);
    messagesRef.current = cached?.messages || [];
    setLoading(!cached);
    setHasOlderMessages(Boolean(cached?.hasOlderMessages));
    olderPageRef.current = cached?.nextPage || 2;
    olderRequestRef.current = false;
    setError("");
    setTypingUser(false);
    setCallSignals([]);
    setConversationHidden(false);
    loadMessages();

    if (!conversationId) return () => { active = false; };

    const clearHeartbeat = () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const connect = () => {
      if (!active) return;
      const socket = messageService.createSocket(conversationId);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setError("");
        socket.send(JSON.stringify({ type: "read" }));
        clearHeartbeat();
        heartbeatRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "heartbeat_ack") return;
          if (data.type === "typing") {
            setTypingUser(data.is_typing ? data.user_id : false);
            return;
          }
          if (data.type === "call_signal") {
            setCallSignals((current) => [...current, data]);
            return;
          }
          if (data.type === "error") {
            setError(data.message || "Chat connection reported an error.");
            return;
          }
          if (data.type === "message") {
            const message = data.message || data;
            setMessages((current) => {
              const exists = current.some(
                (item) => item.id && message.id
                  && String(item.id) === String(message.id)
              );
              return exists ? current : [...current, message];
            });
            if (String(message.sender?.id ?? message.sender) !== String(user?.id)) {
              socket.send(JSON.stringify({ type: "read" }));
            }
            return;
          }
          if (data.type === "message_updated") {
            setMessages((current) => current.map((message) => (
              message.id === data.message.id ? data.message : message
            )));
            return;
          }
          if (data.type === "message_deleted") {
            setMessages((current) => current.map((message) => (
              message.id === data.message_id
                ? { ...message, content: "", is_deleted: true }
                : message
            )));
            return;
          }
          if (data.type === "seen") {
            const seenIds = new Set(data.message_ids);
            setMessages((current) => current.map((message) => (
              seenIds.has(message.id) ? { ...message, is_read: true } : message
            )));
            return;
          }
          if (data.type === "conversation_hidden") {
            setConversationHidden(true);
            socket.close(4003, "Conversation hidden");
          }
        } catch (frameError) {
          console.error("Invalid message WebSocket frame:", frameError);
          setError("A chat update could not be read.");
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        clearHeartbeat();
        if (!active) return;
        setConnected(false);

        if (event.code === 4001 || event.code === 4003) {
          setError(
            event.code === 4001
              ? "Please sign in again to continue chatting."
              : "You no longer have access to this conversation."
          );
          return;
        }

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError(
            "Real-time updates are unavailable. You can still send messages."
          );
          return;
        }
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          500 * (2 ** (reconnectAttemptsRef.current - 1)),
          10000
        );
        reconnectRef.current = window.setTimeout(connect, delay);
      };

      socket.onerror = () => {
        if (active) setConnected(false);
      };
    };

    connect();
    return () => {
      active = false;
      isMountedRef.current = false;
      clearHeartbeat();
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [conversationId, loadMessages, user?.id]);

  useEffect(() => {
    if (String(messagesConversationId) !== String(conversationId)) return;
    const hasOlder = messages.length > 30 || hasOlderMessages;
    cacheMessages(conversationId, user?.id, messages.slice(-30), {
      hasOlderMessages: hasOlder,
      nextPage: messages.length > 30 ? 2 : olderPageRef.current,
    });
  }, [
    conversationId,
    hasOlderMessages,
    messages,
    messagesConversationId,
    user?.id,
  ]);

  useEffect(() => {
    const handleVideoUploaded = (event) => {
      if (
        String(event.detail?.conversationId) !== String(conversationId)
        || !event.detail?.message
      ) return;

      const uploadedMessage = event.detail.message;
      setMessages((current) => (
        current.some((message) => String(message.id) === String(uploadedMessage.id))
          ? current
          : [...current, uploadedMessage]
      ));
    };

    window.addEventListener("ricehub:chat-video-uploaded", handleVideoUploaded);
    return () => {
      window.removeEventListener("ricehub:chat-video-uploaded", handleVideoUploaded);
    };
  }, [conversationId]);

  const sendMessage = useCallback(async (content, replyToId) => {
    if (!conversationId) {
      throw new Error("Select a conversation before sending a message.");
    }

    const message = await messageService.sendText(
      conversationId,
      content,
      replyToId
    );
    if (
      isMountedRef.current
      && String(conversationIdRef.current) === String(conversationId)
    ) {
      setMessages((current) => (
        current.some((item) => String(item.id) === String(message.id))
          ? current
          : [...current, message]
      ));
    }
    return message;
  }, [conversationId]);

  const sendTyping = useCallback((isTyping) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
    }
  }, []);

  const sendCallSignal = useCallback((toUserId, signalType, signal = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chat is not connected.");
    }
    socket.send(JSON.stringify({
      type: "call_signal",
      to_user_id: Number(toUserId),
      signal_type: signalType,
      signal,
    }));
  }, []);
  const clearCallSignal = useCallback(() => {
    setCallSignals((current) => current.slice(1));
  }, []);

  return {
    messages: String(messagesConversationId) === String(conversationId)
      ? messages
      : cachedHistory?.messages || [],
    setMessages,
    loading,
    hasOlderMessages,
    loadingOlder,
    loadOlderMessages,
    connected,
    sendMessage,
    sendTyping,
    sendCallSignal,
    callSignal: callSignals[0] || null,
    conversationHidden,
    clearCallSignal,
    typingUser,
    error,
    reload: loadMessages,
  };
}
