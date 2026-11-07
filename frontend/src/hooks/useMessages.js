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

export default function useMessages(conversationId) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [callSignal, setCallSignal] = useState(null);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError("");
      const data = await messageService.messages(conversationId);
      if (isMountedRef.current) {
        setMessages(getArrayResults(data, "Messages"));
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "read" }));
        }
      }
    } catch (loadError) {
      console.error("Messages could not be loaded:", loadError);
      if (isMountedRef.current) setError("Messages could not be loaded.");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let active = true;
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    setMessages([]);
    setError("");
    setTypingUser(false);
    setCallSignal(null);
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
            setCallSignal(data);
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
                (item) => item.id && message.id && item.id === message.id
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
          setError("Chat connection was lost. Please reopen the conversation.");
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

  const sendMessage = useCallback((content, replyToId) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chat is not connected.");
    }
    socket.send(JSON.stringify({
      type: "message",
      message: content,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    }));
  }, []);

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
  const clearCallSignal = useCallback(() => setCallSignal(null), []);

  return {
    messages,
    setMessages,
    loading,
    connected,
    sendMessage,
    sendTyping,
    sendCallSignal,
    callSignal,
    clearCallSignal,
    typingUser,
    error,
    reload: loadMessages,
  };
}
