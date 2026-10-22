import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import messageService from "../services/messageService";
import useAuth from "./useAuth";

export default function useMessages(conversationId) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const messagesLoadedRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError("");
      const data = await messageService.messages(conversationId);
      setMessages(data.results || data);
      messagesLoadedRef.current = true;
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "read" }));
      }
    } catch {
      setError("Messages could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesLoadedRef.current = false;
    setMessages([]);
    loadMessages();
    if (!conversationId) return undefined;

    const socket = messageService.createSocket(conversationId);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      if (messagesLoadedRef.current) {
        socket.send(JSON.stringify({ type: "read" }));
      }
      heartbeatRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, 20000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat_ack") return;

        if (data.type === "typing") {
          setTypingUser(Boolean(data.is_typing));
          return;
        }

        if (data.type === "message") {
          const message = data.message || data;
          setMessages((current) => [...current, message]);
          if (String(message.sender) !== String(user?.id)) {
            socket.send(JSON.stringify({ type: "read" }));
          }
          return;
        }

        if (data.type === "seen") {
          const seenIds = new Set(data.message_ids);
          setMessages((current) =>
            current.map((message) =>
              seenIds.has(message.id) ? { ...message, is_read: true } : message
            )
          );
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [conversationId, loadMessages, user?.id]);

  const sendMessage = useCallback((content) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState!== WebSocket.OPEN) {
      throw new Error("Chat is not connected.");
    }
    socket.send(JSON.stringify({ type: "message", message: content }));
  }, []);

  const sendTyping = useCallback((isTyping) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "typing",
          is_typing: isTyping,
        })
      );
    }
  }, []);

  return {
    messages,
    loading,
    connected,
    sendMessage,
    sendTyping,
    typingUser,
    error,
    reload: loadMessages,
  };
}