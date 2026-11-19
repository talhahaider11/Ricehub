import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useCall } from "../../context/CallContext";
import Avatar from "../common/Avatar";
import {
  dismissSystemNotification,
  getNotificationsEnabled,
} from "../../services/systemNotificationService";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
const CALL_RING_TIMEOUT_MS = 30_000;
const VoiceCallAudio = registerPlugin("VoiceCallAudio");
const AndroidAudio = registerPlugin("AndroidAudio");

function formatCallDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AudioCallButtons({ peer, conversationId }) {
  const { activeCall, startCall } = useCall();
  const { t } = useLanguage();
  const isCallActive = Boolean(activeCall);
  const disabled = !isCallActive && !conversationId;

  return (
    <div className="audio-call-controls" aria-label={t("audioCall")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isCallActive) {
            window.dispatchEvent(new Event("ricehub:restore-call"));
          } else {
            startCall({ peer, conversationId, mode: "audio" });
          }
        }}
        aria-label={t(isCallActive ? "returnToCall" : "startAudioCall")}
        title={t(isCallActive ? "returnToCall" : "startAudioCall")}
      >
        <Phone size={17} aria-hidden="true" />
      </button>
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
  } = useCall();
  const peerId = activeCall?.peerId;
  const peer = activeCall?.peer;
  const callSignal = callSignals[0] || null;
  const sendCallSignal = useCallback((
    targetId,
    signalType,
    signal,
    status,
    durationSeconds,
  ) => {
    if (!activeCall) throw new Error("There is no active call.");
    sendPersonalCallSignal({
      peerId: targetId,
      conversationId: activeCall.conversationId,
      callId: activeCall.callId,
      signalType,
      signal,
      status,
      durationSeconds,
      callerId: activeCall.callerId,
    });
  }, [activeCall, sendPersonalCallSignal]);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteAudioRef = useRef(null);
  const processedCallSignalRef = useRef(null);
  const callSignalSentRef = useRef(false);
  const endedCallRef = useRef(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [callMode, setCallMode] = useState(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    getNotificationsEnabled
  );

  useEffect(() => {
    const updateNotificationSetting = () => {
      setNotificationsEnabled(getNotificationsEnabled());
    };
    window.addEventListener(
      "ricehub:notification-setting-changed",
      updateNotificationSetting
    );
    window.addEventListener("storage", updateNotificationSetting);
    return () => {
      window.removeEventListener(
        "ricehub:notification-setting-changed",
        updateNotificationSetting
      );
      window.removeEventListener("storage", updateNotificationSetting);
    };
  }, []);

  const setAudioOutputRoute = useCallback(async (speakerOn, active = true) => {
    const audio = remoteAudioRef.current;
    if (audio) audio.volume = 1;

    if (Capacitor.isNativePlatform()) {
      await VoiceCallAudio.setSpeakerEnabled({ enabled: speakerOn, active });
      return;
    }

    if (!active) {
      if (typeof audio?.setSinkId === "function") await audio.setSinkId("");
      return;
    }
    if (typeof audio?.setSinkId === "function") {
      const outputs = await navigator.mediaDevices?.enumerateDevices?.() || [];
      const speaker = outputs.find((device) => (
        device.kind === "audiooutput" && /speaker|loudspeaker/i.test(device.label)
      ));
      const earpiece = outputs.find((device) => (
        device.kind === "audiooutput" && /earpiece|receiver/i.test(device.label)
      ));
      const defaultOutput = outputs.find((device) => (
        device.kind === "audiooutput" && device.deviceId === "default"
      ));
      const sinkId = speakerOn
        ? speaker?.deviceId || defaultOutput?.deviceId || ""
        : earpiece?.deviceId || defaultOutput?.deviceId || "";
      await audio.setSinkId(sinkId);
      return;
    }

    const audioSession = navigator.audioSession;
    if (audioSession && "type" in audioSession) {
      audioSession.type = speakerOn ? "playback" : "play-and-record";
      return;
    }
    if (active) {
      throw new Error(t("speakerRoutingUnsupported"));
    }
  }, [t]);

  const closeCall = useCallback((preserveCallMode = false, preserveActiveCall = false) => {
    if (activeCall?.callId) {
      void dismissSystemNotification(`call-${activeCall.callId}`);
    }
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
    setRemoteStream(null);
    setCallDuration(0);
    if (!preserveCallMode) setCallMode(null);
    setMuted(false);
    setIsSpeakerOn(false);
    void setAudioOutputRoute(false, false).catch((routeError) => {
      console.error("Call audio route could not be restored:", routeError);
      setError(routeError.message || t("speakerRoutingFailed"));
    });
    setPermissionDenied(false);
    setCallState("idle");
    setCallMinimized(false);
    if (!preserveActiveCall) clearActiveCall();
  }, [activeCall?.callId, clearActiveCall, setAudioOutputRoute, t]);

  const createPeerConnection = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      throw new Error(t("audioCallUnsupported"));
    }

    if (Capacitor.isNativePlatform()) {
      await setAudioOutputRoute(isSpeakerOn, true);
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;

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
  }, [closeCall, isSpeakerOn, peerId, sendCallSignal, setAudioOutputRoute, t]);

  const flushPendingCandidates = useCallback(async (connection) => {
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = 1;
    }
  }, [remoteStream]);

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
            sendCallSignal(peerId, "reject", {}, "missed");
            return;
          }
          callSignalSentRef.current = true;
          endedCallRef.current = false;
          incomingOfferRef.current = callSignal.signal;
          setCallMode("audio");
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

    setCallMode("audio");
    setCallMinimized(false);
    if (activeCall.direction === "outgoing" && callState === "idle") {
      void startCall();
    }
  }, [activeCall?.callId]);

  useEffect(() => {
    const ringing = callState === "calling"
      || callState === "ringing"
      || callState === "incoming";
    if (!ringing || !notificationsEnabled) return undefined;

    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() !== "android" || callState !== "incoming") {
        return undefined;
      }

      if (window.RiceHubNativeAudio) {
        window.RiceHubNativeAudio.playDefaultRingtone();
      } else {
        AndroidAudio.playDefaultRingtone().catch((ringError) => {
          console.error("The default call ringtone could not be played:", ringError);
        });
      }
      return () => {
        if (window.RiceHubNativeAudio) {
          window.RiceHubNativeAudio.stopDefaultRingtone();
        } else {
          AndroidAudio.stopDefaultRingtone().catch((ringError) => {
            console.error("The default call ringtone could not be stopped:", ringError);
          });
        }
      };
    }

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
    const resumeAudio = () => {
      if (!audioContext || audioContext.state !== "suspended") return;
      audioContext.resume()
        .then(ring)
        .catch((ringError) => {
          console.warn("Call ringtone could not be resumed:", ringError);
        });
    };

    try {
      audioContext = new AudioContext();
      audioContext.resume().catch((ringError) => {
        console.warn("Call ringtone could not be started:", ringError);
      });
      window.addEventListener("pointerdown", resumeAudio, { once: true });
      window.addEventListener("keydown", resumeAudio, { once: true });
      ring();
      ringTimer = window.setInterval(ring, 1800);
    } catch (ringError) {
      console.warn("Call ringtone could not be started:", ringError);
    }

    return () => {
      if (ringTimer) window.clearInterval(ringTimer);
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
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
  }, [callState, notificationsEnabled]);

  useEffect(() => {
    const restoreCall = () => setCallMinimized(false);
    window.addEventListener("ricehub:restore-call", restoreCall);
    return () => window.removeEventListener("ricehub:restore-call", restoreCall);
  }, []);

  useEffect(() => () => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (Capacitor.isNativePlatform()) {
      VoiceCallAudio.setSpeakerEnabled({ enabled: false, active: false })
        .catch((routeError) => {
          console.error("Call audio route could not be restored:", routeError);
        });
    }
  }, []);

  const startCall = async () => {
    setError("");
    setPermissionDenied(false);
    callSignalSentRef.current = false;
    endedCallRef.current = false;
    if (!window.isSecureContext) {
      setError(t("microphoneSecureContext"));
      return;
    }

    setCallMode("audio");
    setCallMinimized(false);
    setCallState("calling");
    try {
      const connection = await createPeerConnection();
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
        setError(t("callPermissionDenied"));
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
      const connection = await createPeerConnection();
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
        setError(t("callPermissionDenied"));
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
          const incoming = activeCall?.direction === "incoming";
          const status = statusOverride
            || (callState === "connected"
              ? "completed"
              : incoming
                ? "missed"
                : ["calling", "ringing"].includes(callState)
                  ? "cancelled"
                  : "cancelled");
          sendCallSignal(
            peerId,
            incoming ? "reject" : "hangup",
            { mode: "audio" },
            status,
            status === "completed" ? callDuration : undefined
          );
        }
      } catch (signalError) {
        setError(signalError.message || t("callEndFailed"));
      }
    }
    closeCall();
  }, [activeCall?.direction, callDuration, callState, closeCall, peerId, sendCallSignal, t]);

  useEffect(() => {
    if (!["ringing", "incoming"].includes(callState)) return undefined;
    const timer = window.setTimeout(() => {
      setError(t("callNoAnswer"));
      endCall(activeCall?.direction === "incoming" ? "missed" : "unanswered");
    }, CALL_RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [activeCall?.direction, callState, endCall, t]);

  useEffect(() => {
    if (!notificationsEnabled && callState === "incoming") {
      endCall("missed");
    }
  }, [callState, endCall, notificationsEnabled]);

  useEffect(() => {
    if (
      activeCall?.callId
      && ["connecting", "connected"].includes(callState)
    ) {
      void dismissSystemNotification(`call-${activeCall.callId}`);
    }
  }, [activeCall?.callId, callState]);

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const toggleSpeaker = async () => {
    const nextSpeakerOn = !isSpeakerOn;
    try {
      await setAudioOutputRoute(nextSpeakerOn, true);
      setIsSpeakerOn(nextSpeakerOn);
      setError("");
    } catch (routeError) {
      console.error("Call speaker route could not be changed:", routeError);
      setError(routeError.message || t("speakerRoutingFailed"));
    }
  };

  const callName = [
    peer?.first_name,
    peer?.last_name,
  ].filter(Boolean).join(" ") || peer?.username || t("conversation");
  const callStatus = callState === "incoming"
    ? t("incomingCall")
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
          <button type="button" onClick={() => void startCall()}>
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
          className={`call-screen${callMinimized ? " call-screen-minimized" : ""}`}
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

          <main className="call-screen-stage">
            <div className="call-screen-waiting">
              <Avatar user={peer} size="large" />
              <p>{callStatus}</p>
              <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                aria-label={t("remoteCallAudio")}
              />
            </div>
            {(error || signalingError) && (
              <p className="call-screen-error" role="alert">
                {error || signalingError}
              </p>
            )}
            {permissionDenied && (
              <div className="message-permission-help call-permission-help" role="group">
                <p>{t("callMediaPermissionSteps")}</p>
                <button
                  type="button"
                  onClick={() => callState === "incoming"
                    ? void acceptCall()
                    : void startCall()}
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
                  <Phone size={23} aria-hidden="true" />
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
                  className={isSpeakerOn ? "is-active" : ""}
                  onClick={() => void toggleSpeaker()}
                  aria-label={isSpeakerOn ? t("speakerOff") : t("speakerOn")}
                  aria-pressed={isSpeakerOn}
                >
                  {isSpeakerOn
                    ? <Volume2 size={22} aria-hidden="true" />
                    : <VolumeX size={22} aria-hidden="true" />}
                  <span>{t("speaker")}</span>
                </button>
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
