import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import messageService from "../services/messageService";
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
  const socketRef = useRef(null);
  const conversationIdRef = useRef(conversationId);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [callSignals, setCallSignals] = useState([]);
  const [conversationHidden, setConversationHidden] = useState(false);
  const [error, setError] = useState("");
  conversationIdRef.current = conversationId;

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const requestConversationId = conversationId;
    const isCurrentConversation = () => (
      isMountedRef.current
      && String(conversationIdRef.current) === String(requestConversationId)
    );
    try {
      setLoading(true);
      setError("");
      const data = await messageService.messages(conversationId);
      if (isCurrentConversation()) {
        const loadedMessages = getArrayResults(data, "Messages").reverse();
        setMessages((current) => mergeMessages(loadedMessages, current));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "read" }));
        }
      }
    } catch (loadError) {
      console.error("Messages could not be loaded:", loadError);
      if (isCurrentConversation()) setError("Messages could not be loaded.");
    } finally {
      if (isCurrentConversation()) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    setMessages([]);
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
    messages,
    setMessages,
    loading,
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
