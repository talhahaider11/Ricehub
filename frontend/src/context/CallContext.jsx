import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useAuth from "../hooks/useAuth";
import messageService from "../services/messageService";
import { ACCESS_TOKEN_KEY, WS_URL } from "../utils/constants";

export const CallContext = createContext(null);

function createCallId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes]
    .map((byte, index) => `${[4, 6, 8, 10].includes(index) ? "-" : ""}${byte.toString(16).padStart(2, "0")}`)
    .join("");
}

export function CallProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const activeCallRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const nextSignalIdRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [callSignals, setCallSignals] = useState([]);
  const [error, setError] = useState("");

  const updateActiveCall = useCallback((nextCall) => {
    activeCallRef.current = nextCall;
    setActiveCall(nextCall);
  }, []);

  const sendCallSignal = useCallback(({
    peerId,
    conversationId,
    callId,
    signalType,
    signal = {},
    status,
    durationSeconds,
    callerId,
  }) => {
    const socket = socketRef.current;
    const frame = {
      type: "call_signal",
      to_user_id: Number(peerId),
      conversation_id: Number(conversationId),
      call_id: callId,
      caller_id: Number(callerId || user?.id),
      call_type: "audio",
      signal_type: signalType,
      signal,
      ...(status ? { status } : {}),
      ...(Number.isInteger(durationSeconds) ? { duration_seconds: durationSeconds } : {}),
    };
    const fallbackToRest = () => {
      messageService.sendCallSignal(frame).catch((signalError) => {
        console.error("Fallback call signal could not be delivered:", signalError);
        setError(signalError.message || "Call signal could not be delivered.");
      });
    };

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      fallbackToRest();
      return;
    }

    try {
      socket.send(JSON.stringify(frame));
    } catch (sendError) {
      console.error("Call WebSocket send failed; using REST fallback:", sendError);
      fallbackToRest();
    }
  }, [user?.id]);

  const startCall = useCallback(({ peer, conversationId }) => {
    if (activeCallRef.current) {
      setError("Another call is already active.");
      return;
    }

    updateActiveCall({
      peer,
      peerId: peer.id,
      callerId: user?.id,
      conversationId,
      mode: "audio",
      direction: "outgoing",
      callId: createCallId(),
    });
    setError("");
  }, [updateActiveCall, user?.id]);

  const clearCallSignal = useCallback((signalId) => {
    setCallSignals((current) => current.filter((signal) => signal.id !== signalId));
  }, []);

  const clearActiveCall = useCallback(() => {
    updateActiveCall(null);
    setCallSignals([]);
  }, [updateActiveCall]);

  useEffect(() => {
    if (!user?.id) {
      setConnected(false);
      setCallSignals([]);
      setError("");
      updateActiveCall(null);
      return undefined;
    }

    let active = true;
    const connect = () => {
      if (!active) return;
      const token = localStorage.getItem(ACCESS_TOKEN_KEY)
        || localStorage.getItem("access_token");
      if (!token) return;

      const socket = new WebSocket(
        `${WS_URL}/call-signaling/?token=${encodeURIComponent(token)}`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        if (!active || socketRef.current !== socket) return;
        reconnectDelayRef.current = 1000;
        setConnected(true);
        setError("");
        if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = window.setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          try {
            socket.send(JSON.stringify({ type: "ping" }));
          } catch (heartbeatError) {
            console.error("Call signaling heartbeat failed:", heartbeatError);
            socket.close();
          }
        }, 25_000);
      };

      socket.onmessage = (event) => {
        if (!active || socketRef.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") return;
          if (data.type === "error") {
            setError(data.message || "Call signaling failed.");
            return;
          }
          if (data.type !== "call_signal" && data.type !== "incoming_call") return;

          const signal = {
            ...data,
            id: ++nextSignalIdRef.current,
          };
          const currentCall = activeCallRef.current;
          if (signal.signal_type === "offer") {
            if (!currentCall) {
              updateActiveCall({
                peerId: signal.from_user_id,
                callerId: signal.caller_id || signal.from_user_id,
                peer: {
                  id: signal.from_user_id,
                  first_name: signal.caller_name,
                  profile_picture: signal.caller_avatar,
                },
                conversationId: signal.conversation_id,
                callId: signal.call_id,
                mode: "audio",
                direction: "incoming",
              });
              setCallSignals([signal]);
              return;
            }
            try {
              sendCallSignal({
                peerId: signal.from_user_id,
                conversationId: signal.conversation_id,
                callId: signal.call_id,
                signalType: "reject",
                status: "missed",
                callerId: signal.caller_id || signal.from_user_id,
              });
            } catch (sendError) {
              console.error("Busy call could not be rejected:", sendError);
            }
            return;
          }

          if (
            currentCall
            && String(signal.from_user_id) === String(currentCall.peerId)
            && String(signal.conversation_id) === String(currentCall.conversationId)
            && signal.call_id === currentCall.callId
          ) {
            setCallSignals((current) => [...current, signal]);
          }
        } catch (parseError) {
          console.error("Call signaling message could not be read:", parseError);
          setError("Call signaling message could not be read.");
        }
      };

      socket.onerror = () => {
        if (active && socketRef.current === socket) {
          setConnected(false);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (heartbeatRef.current) {
          window.clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (!active) return;
        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(
          connect,
          reconnectDelayRef.current
        );
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          15_000
        );
      };
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [sendCallSignal, updateActiveCall, user?.id]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callSignals,
        clearActiveCall,
        clearCallSignal,
        connected,
        error,
        sendCallSignal,
        startCall,
        user,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider.");
  }
  return context;
}
