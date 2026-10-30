import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import messageService from "../services/messageService";
import useAuth from "./useAuth";
import { getArrayResults } from "../utils/arrayResults";

export default function useMessages(conversationId) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isMountedRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [error, setError] = useState("");

  // Initial Rest API Messages Loader
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError("");
      const data = await messageService.messages(conversationId);
      
      if (isMountedRef.current) {
        setMessages(getArrayResults(data, "Messages"));
        
        // Mark Messages as Read over WS if socket is active
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "read" }));
        }
      }
    } catch (loadError) {
      console.error("Messages could not be loaded:", loadError);
      if (isMountedRef.current) {
        setError("Messages could not be loaded.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    isMountedRef.current = true;
    setMessages([]);
    loadMessages();

    if (!conversationId) return undefined;

    // Previous active socket cleanup before re-initializing
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    // WebSocket Connection Initialization
    const socket = messageService.createSocket(conversationId);
    socketRef.current = socket;

    socket.onopen = () => {
      if (!isMountedRef.current) return;
      setConnected(true);
      
      // Send initial read status
      socket.send(JSON.stringify({ type: "read" }));

      // Heartbeat Keep-Alive Interval (Every 20s)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, 20000);
    };

    socket.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const data = JSON.parse(event.data);
        if (data.type === "heartbeat_ack") return;

        // Typing Indicator Handling
        if (data.type === "typing") {
          setTypingUser(Boolean(data.is_typing));
          return;
        }

        // Incoming Real-time Message Handling
        if (data.type === "message") {
          const message = data.message || data;
          
          setMessages((current) => {
            // Duplicate message prevention check by ID
            const exists = current.some((m) => m.id && message.id && m.id === message.id);
            if (exists) return current;
            return [...current, message];
          });

          // If incoming message is from other user, send read ack
          if (String(message.sender) !== String(user?.id)) {
            socket.send(JSON.stringify({ type: "read" }));
          }
          return;
        }

        // Seen / Read Receipt Updates
        if (data.type === "seen") {
          const seenIds = new Set(data.message_ids);
          setMessages((current) =>
            current.map((message) =>
              seenIds.has(message.id) ? { ...message, is_read: true } : message
            )
          );
        }
      } catch {
        // Silent handling for malformed frames
      }
    };

    socket.onclose = () => {
      if (isMountedRef.current) setConnected(false);
    };

    socket.onerror = () => {
      if (isMountedRef.current) setConnected(false);
    };

    // Component Cleanup
    return () => {
      isMountedRef.current = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [conversationId, loadMessages, user?.id]);

  // Send Message Method
  const sendMessage = useCallback((content) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chat is not connected.");
    }
    socket.send(JSON.stringify({ type: "message", message: content }));
  }, []);

  // Send Typing Indicator Method
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