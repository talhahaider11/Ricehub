import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useCall } from "../../context/CallContext";
import Avatar from "../common/Avatar";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
];
const CALL_RING_TIMEOUT_MS = 30_000;

function formatCallDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AudioCallButtons({ peer, conversationId }) {
  const { activeCall, connected, startCall } = useCall();
  const { t } = useLanguage();
  const disabled = !connected || !conversationId || Boolean(activeCall);

  return (
    <div className="audio-call-controls" aria-label={t("audioCall")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => startCall({ peer, conversationId, mode: "audio" })}
        aria-label={t("startAudioCall")}
        title={t("startAudioCall")}
      >
        <Phone size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => startCall({ peer, conversationId, mode: "video" })}
        aria-label={t("startVideoCall")}
        title={t("startVideoCall")}
      >
        <Video size={17} aria-hidden="true" />
      </button>
      {activeCall && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("ricehub:restore-call"))}
          aria-label={t("returnToCall")}
          title={t("returnToCall")}
        >
          <Phone size={17} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function AudioCallControls() {
  const { t } = useLanguage();
  const {
    activeCall,
    callSignals,
    clearActiveCall,
    clearCallSignal,
    error: signalingError,
    sendCallSignal: sendPersonalCallSignal,
    user: currentUser,
  } = useCall();
  const peerId = activeCall?.peerId;
  const peer = activeCall?.peer;
  const callSignal = callSignals[0] || null;
  const sendCallSignal = useCallback((targetId, signalType, signal, status) => {
    if (!activeCall) throw new Error("There is no active call.");
    sendPersonalCallSignal({
      peerId: targetId,
      conversationId: activeCall.conversationId,
      callId: activeCall.callId,
      callType: activeCall.mode,
      signalType,
      signal,
      status,
    });
  }, [activeCall, sendPersonalCallSignal]);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callStageRef = useRef(null);
  const localVideoContainerRef = useRef(null);
  const localVideoDragRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const processedCallSignalRef = useRef(null);
  const callSignalSentRef = useRef(false);
  const endedCallRef = useRef(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [callMode, setCallMode] = useState(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("user");
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [localVideoPosition, setLocalVideoPosition] = useState(null);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const closeCall = useCallback((preserveCallMode = false, preserveActiveCall = false) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
    }
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    incomingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    callSignalSentRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setCallDuration(0);
    if (!preserveCallMode) setCallMode(null);
    setMuted(false);
    setCameraOff(false);
    setCameraFacing("user");
    setCameraSwitching(false);
    setLocalVideoPosition(null);
    localVideoDragRef.current = null;
    setSpeakerEnabled(true);
    setPermissionDenied(false);
    setCallState("idle");
    setCallMinimized(false);
    if (!preserveActiveCall) clearActiveCall();
  }, [clearActiveCall]);

  const createPeerConnection = useCallback(async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error(
        mode === "video" ? t("videoCallUnsupported") : t("audioCallUnsupported")
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video" ? { facingMode: { ideal: "user" } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.ontrack = (event) => {
      const incomingStream = event.streams?.[0];
      if (incomingStream) {
        setRemoteStream(incomingStream);
      } else {
        const streamFromTracks = new MediaStream();
        streamFromTracks.addTrack(event.track);
        setRemoteStream(streamFromTracks);
      }
    };
    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      try {
        sendCallSignal(peerId, "ice_candidate", event.candidate.toJSON());
      } catch (signalError) {
        setError(signalError.message || t("callSignalFailed"));
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") {
        setCallState("connected");
      } else if (["failed", "disconnected"].includes(connection.connectionState)) {
        setError(t("callConnectionLost"));
        closeCall();
      }
    };
    return connection;
  }, [closeCall, peerId, sendCallSignal, t]);

  const flushPendingCandidates = useCallback(async (connection) => {
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = !speakerEnabled;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = !speakerEnabled;
    }
  }, [localStream, remoteStream, speakerEnabled]);

  useEffect(() => {
    if (callState !== "connected") {
      setCallDuration(0);
      return undefined;
    }
    const connectedAt = Date.now();
    const timer = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - connectedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    if (!callSignal || String(callSignal.from_user_id) !== String(peerId)) return;
    if (processedCallSignalRef.current === callSignal.id) return;
    processedCallSignalRef.current = callSignal.id;

    const processSignal = async () => {
      try {
        if (callSignal.signal_type === "offer") {
          if (callState !== "idle") {
            sendCallSignal(peerId, "reject", {}, "rejected");
            return;
          }
          callSignalSentRef.current = true;
          endedCallRef.current = false;
          incomingOfferRef.current = callSignal.signal;
          setCallMode(callSignal.call_type || "audio");
          setCallMinimized(false);
          setCallState("incoming");
          setError("");
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
        } else if (["hangup", "reject"].includes(callSignal.signal_type)) {
          setError(t("callEnded"));
          closeCall();
        }
      } catch (signalError) {
        setError(signalError.message || t("callSetupFailed"));
        closeCall();
      } finally {
        clearCallSignal(callSignal.id);
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
    t,
  ]);

  useEffect(() => {
    if (!activeCall) {
      if (callState !== "idle") closeCall();
      return;
    }

    setCallMode(activeCall.mode);
    setCallMinimized(false);
    if (activeCall.direction === "outgoing" && callState === "idle") {
      void startCall(activeCall.mode);
    }
  }, [activeCall?.callId]);

  useEffect(() => {
    const ringing = callState === "calling"
      || callState === "ringing"
      || callState === "incoming";
    if (!ringing) return undefined;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return undefined;

    let audioContext;
    const oscillators = new Set();
    let ringTimer;
    const ring = () => {
      if (!audioContext || audioContext.state === "closed") return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.onended = () => oscillators.delete(oscillator);
      oscillators.add(oscillator);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.46);
    };

    try {
      audioContext = new AudioContext();
      const resume = audioContext.resume();
      resume?.catch(() => {});
      ring();
      ringTimer = window.setInterval(ring, 1800);
    } catch (ringError) {
      console.warn("Call ringtone could not be started:", ringError);
    }

    return () => {
      if (ringTimer) window.clearInterval(ringTimer);
      oscillators.forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch {
          // The oscillator may already have stopped naturally.
        }
      });
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
    };
  }, [callState]);

  useEffect(() => {
    const restoreCall = () => setCallMinimized(false);
    window.addEventListener("ricehub:restore-call", restoreCall);
    return () => window.removeEventListener("ricehub:restore-call", restoreCall);
  }, []);

  useEffect(() => () => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCall = async (mode) => {
    setError("");
    setPermissionDenied(false);
    callSignalSentRef.current = false;
    endedCallRef.current = false;
    if (!window.isSecureContext) {
      setError(t("microphoneSecureContext"));
      return;
    }

    setCallMode(mode);
    setCallMinimized(false);
    setCallState("calling");
    try {
      const connection = await createPeerConnection(mode);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendCallSignal(
        peerId,
        "offer",
        connection.localDescription.toJSON?.() || connection.localDescription
      );
      callSignalSentRef.current = true;
      setCallState("ringing");
    } catch (callError) {
      const denied = callError.name === "NotAllowedError"
        || callError.name === "SecurityError";
      if (denied) {
        setPermissionDenied(true);
        setError(t(mode === "video" ? "videoCallPermissionDenied" : "callPermissionDenied"));
      } else {
        setError(callError.message || t("callStartFailed"));
      }
      closeCall(denied, denied);
      if (denied) setPermissionDenied(true);
    }
  };

  const acceptCall = async () => {
    setError("");
    setPermissionDenied(false);
    try {
      const connection = await createPeerConnection(callMode);
      await connection.setRemoteDescription(incomingOfferRef.current);
      await flushPendingCandidates(connection);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendCallSignal(
        peerId,
        "answer",
        connection.localDescription.toJSON?.() || connection.localDescription
      );
      setCallState("connecting");
    } catch (callError) {
      if (callError.name === "NotAllowedError" || callError.name === "SecurityError") {
        setPermissionDenied(true);
        setError(t(callMode === "video" ? "videoCallPermissionDenied" : "callPermissionDenied"));
      } else {
        setError(callError.message || t("incomingCallAnswerFailed"));
        closeCall();
      }
    }
  };

  const endCall = useCallback((statusOverride) => {
    if (callState !== "idle" && !endedCallRef.current) {
      endedCallRef.current = true;
      try {
        if (callSignalSentRef.current) {
          const incoming = callState === "incoming";
          const status = statusOverride
            || (incoming
              ? "rejected"
              : ["calling", "ringing"].includes(callState)
                ? "cancelled"
                : undefined);
          sendCallSignal(
            peerId,
            incoming ? "reject" : "hangup",
            { mode: callMode || "audio" },
            status
          );
        }
      } catch (signalError) {
        setError(signalError.message || t("callEndFailed"));
      }
    }
    closeCall();
  }, [callMode, callState, closeCall, peerId, sendCallSignal, t]);

  useEffect(() => {
    if (!["ringing", "incoming"].includes(callState)) return undefined;
    const timer = window.setTimeout(() => {
      setError(t("callNoAnswer"));
      endCall(activeCall?.direction === "incoming" ? "unanswered" : "missed");
    }, CALL_RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [activeCall?.direction, callState, endCall, t]);

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const toggleCamera = () => {
    const nextCameraOff = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setCameraOff(nextCameraOff);
  };

  const handleLocalVideoPointerDown = (event) => {
    if (event.button > 0 || !callStageRef.current || !localVideoContainerRef.current) {
      return;
    }

    const stageRect = callStageRef.current.getBoundingClientRect();
    const videoRect = localVideoContainerRef.current.getBoundingClientRect();
    localVideoDragRef.current = {
      pointerId: event.pointerId,
      pointerX: Number.isFinite(event.clientX) ? event.clientX : 0,
      pointerY: Number.isFinite(event.clientY) ? event.clientY : 0,
      left: videoRect.left - stageRect.left,
      top: videoRect.top - stageRect.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleLocalVideoPointerMove = (event) => {
    const drag = localVideoDragRef.current;
    const stage = callStageRef.current;
    const preview = localVideoContainerRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage || !preview) return;

    const maxLeft = Math.max(0, stage.clientWidth - preview.offsetWidth);
    const maxTop = Math.max(0, stage.clientHeight - preview.offsetHeight);
    const pointerX = Number.isFinite(event.clientX) ? event.clientX : drag.pointerX;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : drag.pointerY;
    setLocalVideoPosition({
      left: Math.min(maxLeft, Math.max(0, drag.left + pointerX - drag.pointerX)),
      top: Math.min(maxTop, Math.max(0, drag.top + pointerY - drag.pointerY)),
    });
  };

  const handleLocalVideoPointerEnd = (event) => {
    if (localVideoDragRef.current?.pointerId !== event.pointerId) return;
    localVideoDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const moveLocalVideoWithKeyboard = (event) => {
    const preview = localVideoContainerRef.current;
    const stage = callStageRef.current;
    if (!preview || !stage || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const rect = preview.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const currentLeft = localVideoPosition?.left ?? rect.left - stageRect.left;
    const currentTop = localVideoPosition?.top ?? rect.top - stageRect.top;
    const offset = event.shiftKey ? 20 : 8;
    const maxLeft = Math.max(0, stage.clientWidth - preview.offsetWidth);
    const maxTop = Math.max(0, stage.clientHeight - preview.offsetHeight);
    setLocalVideoPosition({
      left: Math.min(maxLeft, Math.max(0, currentLeft
        + (event.key === "ArrowRight" ? offset : event.key === "ArrowLeft" ? -offset : 0))),
      top: Math.min(maxTop, Math.max(0, currentTop
        + (event.key === "ArrowDown" ? offset : event.key === "ArrowUp" ? -offset : 0))),
    });
  };

  const switchCamera = async () => {
    const stream = localStreamRef.current;
    const connection = peerConnectionRef.current;
    if (!stream || !connection || cameraSwitching) return;

    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    let replacementStream;
    let replacedTrack = false;
    setCameraSwitching(true);
    setError("");
    try {
      replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextFacing } },
      });
      if (peerConnectionRef.current !== connection || localStreamRef.current !== stream) {
        replacementStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const replacementTrack = replacementStream.getVideoTracks()[0];
      const videoSender = connection.getSenders().find((sender) => sender.track?.kind === "video");
      if (!replacementTrack || !videoSender) {
        throw new Error(t("callCameraSwitchFailed"));
      }

      replacementTrack.enabled = !cameraOff;
      const oldVideoTracks = stream.getVideoTracks();
      const updatedStream = new MediaStream([
        ...stream.getAudioTracks(),
        replacementTrack,
      ]);
      await videoSender.replaceTrack(replacementTrack);
      replacedTrack = true;
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      oldVideoTracks.forEach((track) => track.stop());
      setCameraFacing(nextFacing);
    } catch {
      if (!replacedTrack) replacementStream?.getTracks().forEach((track) => track.stop());
      setError(t("callCameraSwitchFailed"));
    } finally {
      setCameraSwitching(false);
    }
  };

  const callName = [
    peer?.first_name,
    peer?.last_name,
  ].filter(Boolean).join(" ") || peer?.username || t("conversation");
  const callStatus = callState === "incoming"
    ? t(callMode === "video" ? "incomingVideoCall" : "incomingCall")
    : callState === "connected"
      ? `${t("callConnected")} · ${formatCallDuration(callDuration)}`
      : callState === "connecting"
        ? t("callConnecting")
        : t("calling");
  const showCallScreen = callState !== "idle" && callMode;

  if (
    !activeCall
    && callState === "idle"
    && !signalingError
    && !error
    && !permissionDenied
  ) {
    return null;
  }

  return (
    <section className="audio-call-controls" aria-label={t("audioCall")}>
      {signalingError && callState === "idle" && (
        <span className="error" role="alert">{signalingError}</span>
      )}
      {error && callState === "idle" && <span className="error" role="alert">{error}</span>}
      {permissionDenied && callState === "idle" && (
        <div className="call-setup-permission-help" role="group">
          <p>{t("callMediaPermissionSteps")}</p>
          <button type="button" onClick={() => void startCall(callMode || "audio")}>
            {t("requestCallPermissionAgain")}
          </button>
        </div>
      )}
      {activeCall && callMinimized && (
        <button
          type="button"
          onClick={() => setCallMinimized(false)}
          aria-label={t("returnToCall")}
          title={t("returnToCall")}
        >
          <Phone size={17} aria-hidden="true" />
        </button>
      )}
      {showCallScreen && createPortal(
        <section
          className={`call-screen${callMode === "video" ? " call-screen-video" : ""}${callMinimized ? " call-screen-minimized" : ""}`}
          role="dialog"
          aria-modal={!callMinimized}
          aria-hidden={callMinimized}
          aria-labelledby="call-screen-name"
        >
          <header className="call-screen-header">
            <div>
              <h2 id="call-screen-name">{callName}</h2>
              <p aria-live="polite">{callStatus}</p>
            </div>
            <button
              type="button"
              onClick={() => setCallMinimized(true)}
              aria-label={t("minimizeCall")}
              title={t("minimizeCall")}
            >
              <Minimize2 size={20} aria-hidden="true" />
            </button>
          </header>

          <main className="call-screen-stage" ref={callStageRef}>
            {callMode === "video" ? (
              <>
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    className="call-remote-video"
                    autoPlay
                    playsInline
                    aria-label={t("remoteCallVideo")}
                  />
                ) : (
                  <div className="call-screen-waiting">
                    <Avatar user={peer} size="large" />
                    <p>{callStatus}</p>
                  </div>
                )}
                {localStream && (
                  <div
                    ref={localVideoContainerRef}
                    className="call-local-video"
                    role="button"
                    tabIndex={0}
                    aria-label={t("moveLocalVideo")}
                    onPointerDown={handleLocalVideoPointerDown}
                    onPointerMove={handleLocalVideoPointerMove}
                    onPointerUp={handleLocalVideoPointerEnd}
                    onPointerCancel={handleLocalVideoPointerEnd}
                    onKeyDown={moveLocalVideoWithKeyboard}
                    style={localVideoPosition
                      ? {
                        left: localVideoPosition.left,
                        top: localVideoPosition.top,
                        right: "auto",
                        bottom: "auto",
                      }
                      : undefined}
                  >
                    {cameraOff ? (
                      <Avatar user={currentUser} size="medium" />
                    ) : (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        aria-label={t("localCallVideo")}
                      />
                    )}
                    <span>{t("you")}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="call-screen-waiting">
                <Avatar user={peer} size="large" />
                <p>{callStatus}</p>
                <audio
                  ref={remoteAudioRef}
                  autoPlay
                  aria-label={t("remoteCallAudio")}
                />
              </div>
            )}
            {error && <p className="call-screen-error" role="alert">{error}</p>}
            {permissionDenied && (
              <div className="message-permission-help call-permission-help" role="group">
                <p>{t("callMediaPermissionSteps")}</p>
                <button
                  type="button"
                  onClick={() => callState === "incoming"
                    ? void acceptCall()
                    : void startCall(callMode)}
                >
                  {t("requestCallPermissionAgain")}
                </button>
              </div>
            )}
          </main>

          <footer className="call-screen-controls">
            {callState === "incoming" ? (
              <>
                <button
                  type="button"
                  className="call-control-decline"
                  onClick={() => endCall()}
                  aria-label={t("declineCall")}
                >
                  <PhoneOff size={23} aria-hidden="true" />
                  <span>{t("declineCall")}</span>
                </button>
                <button
                  type="button"
                  className="call-control-answer"
                  onClick={() => void acceptCall()}
                  aria-label={t("answerCall")}
                >
                  {callMode === "video"
                    ? <Video size={23} aria-hidden="true" />
                    : <Phone size={23} aria-hidden="true" />}
                  <span>{t("answerCall")}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={muted ? "is-active" : ""}
                  onClick={toggleMute}
                  aria-label={muted ? t("unmute") : t("mute")}
                  aria-pressed={muted}
                >
                  {muted
                    ? <MicOff size={22} aria-hidden="true" />
                    : <Mic size={22} aria-hidden="true" />}
                  <span>{muted ? t("unmute") : t("mute")}</span>
                </button>
                <button
                  type="button"
                  className={!speakerEnabled ? "is-active" : ""}
                  onClick={() => setSpeakerEnabled((enabled) => !enabled)}
                  aria-label={speakerEnabled ? t("speakerOff") : t("speakerOn")}
                  aria-pressed={!speakerEnabled}
                >
                  {speakerEnabled
                    ? <Volume2 size={22} aria-hidden="true" />
                    : <VolumeX size={22} aria-hidden="true" />}
                  <span>{t("speaker")}</span>
                </button>
                {callMode === "video" && (
                  <>
                    <button
                      type="button"
                      className={cameraOff ? "is-active" : ""}
                      onClick={toggleCamera}
                      aria-label={cameraOff ? t("cameraOn") : t("cameraOff")}
                      aria-pressed={cameraOff}
                    >
                      {cameraOff
                        ? <VideoOff size={22} aria-hidden="true" />
                        : <Video size={22} aria-hidden="true" />}
                      <span>{cameraOff ? t("cameraOn") : t("cameraOff")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void switchCamera()}
                      disabled={cameraSwitching}
                      aria-label={t(cameraFacing === "user" ? "switchToBackCamera" : "switchToFrontCamera")}
                    >
                      <RefreshCw size={22} aria-hidden="true" />
                      <span>{t(cameraFacing === "user" ? "switchToBackCamera" : "switchToFrontCamera")}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="call-control-end"
                  onClick={() => endCall()}
                  aria-label={t("endCall")}
                >
                  <PhoneOff size={23} aria-hidden="true" />
                  <span>{t("endCall")}</span>
                </button>
              </>
            )}
          </footer>
        </section>,
        document.body
      )}
    </section>
  );
}
