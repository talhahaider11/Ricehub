import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import useAuth from "../hooks/useAuth";
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
    callType,
    signalType,
    signal = {},
    status,
  }) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Call signaling is not connected.");
    }

    socket.send(JSON.stringify({
      type: "call_signal",
      to_user_id: Number(peerId),
      conversation_id: Number(conversationId),
      call_id: callId,
      call_type: callType,
      signal_type: signalType,
      signal,
      ...(status ? { status } : {}),
    }));
  }, []);

  const startCall = useCallback(({ peer, conversationId, mode }) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Call signaling is not connected.");
      return;
    }
    if (activeCallRef.current) {
      setError("Another call is already active.");
      return;
    }

    updateActiveCall({
      peer,
      peerId: peer.id,
      conversationId,
      mode,
      direction: "outgoing",
      callId: createCallId(),
    });
    setError("");
  }, [updateActiveCall]);

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
      };

      socket.onmessage = (event) => {
        if (!active || socketRef.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "error") {
            setError(data.message || "Call signaling failed.");
            return;
          }
          if (data.type !== "call_signal") return;

          const signal = {
            ...data,
            id: ++nextSignalIdRef.current,
          };
          const currentCall = activeCallRef.current;
          if (signal.signal_type === "offer") {
            if (!currentCall) {
              updateActiveCall({
                peerId: signal.from_user_id,
                peer: {
                  id: signal.caller_id || signal.from_user_id,
                  first_name: signal.caller_name,
                  profile_picture: signal.caller_avatar,
                },
                conversationId: signal.conversation_id,
                callId: signal.call_id,
                mode: signal.call_type,
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
                callType: signal.call_type,
                signalType: "reject",
                status: "rejected",
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
