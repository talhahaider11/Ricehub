import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import Avatar from "../common/Avatar";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
];

function formatCallDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function AudioCallControls({
  peerId,
  peer,
  currentUser,
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
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const processedCallSignalRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [callMode, setCallMode] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const closeCall = useCallback((preserveCallMode = false) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
    }
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    incomingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallDuration(0);
    if (!preserveCallMode) setCallMode(null);
    setMuted(false);
    setCameraOff(false);
    setSpeakerEnabled(true);
    setPermissionDenied(false);
    setCallState("idle");
  }, []);

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
    if (processedCallSignalRef.current === callSignal) return;
    processedCallSignalRef.current = callSignal;

    const processSignal = async () => {
      try {
        if (callSignal.signal_type === "offer") {
          if (callState !== "idle") {
            sendCallSignal(peerId, "hangup");
            return;
          }
          incomingOfferRef.current = callSignal.signal;
          setCallMode(callSignal.signal?.sdp?.includes("m=video") ? "video" : "audio");
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
        } else if (callSignal.signal_type === "hangup") {
          setError(t("callEnded"));
          closeCall();
        }
      } catch (signalError) {
        setError(signalError.message || t("callSetupFailed"));
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
    t,
  ]);

  useEffect(() => () => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCall = async (mode) => {
    setError("");
    setPermissionDenied(false);
    if (!window.isSecureContext) {
      setError(t("microphoneSecureContext"));
      return;
    }

    setCallMode(mode);
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
    } catch (callError) {
      const denied = callError.name === "NotAllowedError"
        || callError.name === "SecurityError";
      if (denied) {
        setPermissionDenied(true);
        setError(t(mode === "video" ? "videoCallPermissionDenied" : "callPermissionDenied"));
      } else {
        setError(callError.message || t("callStartFailed"));
      }
      closeCall(denied);
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

  const endCall = () => {
    if (callState !== "idle") {
      try {
        sendCallSignal(peerId, "hangup");
      } catch (signalError) {
        setError(signalError.message || t("callEndFailed"));
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

  const toggleCamera = () => {
    const nextCameraOff = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setCameraOff(nextCameraOff);
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

  return (
    <section className="audio-call-controls" aria-label={t("audioCall")}>
      {callState === "idle" && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void startCall("audio")}
            aria-label={t("startAudioCall")}
            title={t("startAudioCall")}
          >
            <Phone size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void startCall("video")}
            aria-label={t("startVideoCall")}
            title={t("startVideoCall")}
          >
            <Video size={18} aria-hidden="true" />
          </button>
        </>
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
      {showCallScreen && createPortal(
        <section
          className={`call-screen${callMode === "video" ? " call-screen-video" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="call-screen-name"
        >
          <header className="call-screen-header">
            <div>
              <h2 id="call-screen-name">{callName}</h2>
              <p aria-live="polite">{callStatus}</p>
            </div>
          </header>

          <main className="call-screen-stage">
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
                  <div className="call-local-video">
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
          </main>

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

          <footer className="call-screen-controls">
            {callState === "incoming" ? (
              <>
                <button
                  type="button"
                  className="call-control-decline"
                  onClick={endCall}
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
                )}
                <button
                  type="button"
                  className="call-control-end"
                  onClick={endCall}
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
