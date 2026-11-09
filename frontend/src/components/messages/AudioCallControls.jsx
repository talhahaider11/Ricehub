import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
];

export default function AudioCallControls({
  peerId,
  disabled,
  callSignal,
  sendCallSignal,
  clearCallSignal,
}) {
  const { t } = useLanguage();
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteAudioRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");

  const closeCall = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    incomingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setRemoteStream(null);
    setMuted(false);
    setCallState("idle");
  }, []);

  const createPeerConnection = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error("Audio calling is not supported on this device or browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) setRemoteStream(incomingStream);
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        try {
          sendCallSignal(peerId, "ice_candidate", event.candidate.toJSON());
        } catch (signalError) {
          setError(signalError.message || "Call signal could not be sent.");
        }
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") {
        setCallState("connected");
      } else if (["failed", "disconnected", "closed"].includes(connection.connectionState)) {
        if (connection.connectionState !== "closed") {
          setError("The audio call connection was lost.");
          closeCall();
        }
      }
    };
    return connection;
  }, [closeCall, peerId, sendCallSignal]);

  const flushPendingCandidates = useCallback(async (connection) => {
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!callSignal || String(callSignal.from_user_id) !== String(peerId)) return;

    const processSignal = async () => {
      try {
        if (callSignal.signal_type === "offer") {
          if (callState !== "idle") {
            sendCallSignal(peerId, "hangup");
            return;
          }
          incomingOfferRef.current = callSignal.signal;
          setCallState("incoming");
        } else if (callSignal.signal_type === "answer" && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(callSignal.signal);
          await flushPendingCandidates(peerConnectionRef.current);
          setCallState("connecting");
        } else if (callSignal.signal_type === "ice_candidate") {
          if (peerConnectionRef.current?.remoteDescription) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(callSignal.signal)
            );
          } else {
            pendingCandidatesRef.current.push(callSignal.signal);
          }
        } else if (callSignal.signal_type === "hangup") {
          closeCall();
        }
      } catch (signalError) {
        setError(signalError.message || "Call setup failed.");
        closeCall();
      } finally {
        clearCallSignal();
      }
    };

    void processSignal();
  }, [
    callSignal,
    callState,
    clearCallSignal,
    closeCall,
    flushPendingCandidates,
    peerId,
    sendCallSignal,
  ]);

  useEffect(() => () => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCall = async () => {
    setError("");
    try {
      const connection = await createPeerConnection();
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendCallSignal(peerId, "offer", connection.localDescription.toJSON());
      setCallState("calling");
    } catch (callError) {
      setError(callError.message || "The audio call could not be started.");
      closeCall();
    }
  };

  const acceptCall = async () => {
    setError("");
    try {
      const connection = await createPeerConnection();
      await connection.setRemoteDescription(incomingOfferRef.current);
      await flushPendingCandidates(connection);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendCallSignal(peerId, "answer", connection.localDescription.toJSON());
      setCallState("connecting");
    } catch (callError) {
      setError(callError.message || "The incoming call could not be answered.");
      closeCall();
    }
  };

  const endCall = () => {
    if (callState !== "idle") {
      try {
        sendCallSignal(peerId, "hangup");
      } catch (signalError) {
        setError(signalError.message || "Call could not be ended remotely.");
      }
    }
    closeCall();
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  return (
    <section className="audio-call-controls" aria-label="Audio call">
      {callState === "idle" && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void startCall()}
          aria-label="Start audio call"
          title="Start audio call"
        >
          <Phone size={16} aria-hidden="true" />
        </button>
      )}
      {callState === "incoming" && (
        <>
          <span>{t("incomingCall")}</span>
          <button type="button" disabled={disabled} onClick={() => void acceptCall()}>{t("answerCall")}</button>
          <button type="button" onClick={endCall}>
            <PhoneOff size={16} aria-hidden="true" />
            {t("declineCall")}
          </button>
        </>
      )}
      {["calling", "connecting", "connected"].includes(callState) && (
        <>
          <span>{callState === "connected" ? t("callConnected") : t("calling")}</span>
          {callState === "connected" && (
            <button type="button" onClick={toggleMute}>
              {muted
                ? <MicOff size={16} aria-hidden="true" />
                : <Mic size={16} aria-hidden="true" />}
              {muted ? t("unmute") : t("mute")}
            </button>
          )}
          <button type="button" onClick={endCall}>
            <PhoneOff size={16} aria-hidden="true" />
            {t("endCall")}
          </button>
        </>
      )}
      <audio ref={remoteAudioRef} autoPlay aria-label="Remote call audio" />
      {error && <span className="error" role="alert">{error}</span>}
    </section>
  );
}
