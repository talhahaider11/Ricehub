import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLanguage } from "../../context/LanguageContext";
import Avatar from "../common/Avatar";
import { Link } from "react-router-dom";
import MediaViewer from "../media/MediaViewer";
import MessageItem from "./MessageItem";

const MESSAGE_ACTION_HOLD_MS = 1500;
const LONG_PRESS_MOVE_THRESHOLD = 12;
const REPLY_SWIPE_THRESHOLD = 64;
const REPLY_SWIPE_VERTICAL_LIMIT = 48;

function getTimestamp(value, language) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const dateLabel = new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat(language, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return {
    day: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    separator: `${dateLabel} at ${timeLabel}`.toUpperCase(),
    time: timeLabel,
  };
}

export default function MessageList({
  messages,
  currentUser,
  conversationId,
  onReply,
  onEdit,
  onDelete,
  onShare,
  onCallBack,
  conversationPartner,
  showVerificationWarning = false,
  latestConversationMessageId,
  hasOlderMessages = false,
  loadingOlder = false,
  onLoadOlder,
}) {
  const { t, language } = useLanguage();
  const bottomRef =
    useRef(null);
  const listRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const preserveScrollRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const longPressTimer = useRef(null);
  const longPressOrigin = useRef(null);
  const replySwipeOrigin = useRef(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const callbacksRef = useRef({});
  callbacksRef.current = { onReply, onEdit, onDelete, onShare, onCallBack };

  useEffect(() => () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressOrigin.current = null;
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (preserveScrollRef.current && list) {
      list.scrollTop = list.scrollHeight - previousScrollHeightRef.current;
      preserveScrollRef.current = false;
    } else {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (
      !list
      || list.scrollTop > 48
      || !hasOlderMessages
      || loadingOlder
      || loadingOlderRef.current
    ) return;
    loadingOlderRef.current = true;
    previousScrollHeightRef.current = list.scrollHeight;
    preserveScrollRef.current = true;
    Promise.resolve(onLoadOlder?.()).then((loaded) => {
      if (!loaded) preserveScrollRef.current = false;
    }).finally(() => {
      loadingOlderRef.current = false;
    });
  }, [hasOlderMessages, loadingOlder, onLoadOlder]);

  const rowCallbacks = useMemo(() => ({
    onReply: (...args) => callbacksRef.current.onReply?.(...args),
    onEdit: (...args) => callbacksRef.current.onEdit?.(...args),
    onDelete: (...args) => callbacksRef.current.onDelete?.(...args),
    onShare: (...args) => callbacksRef.current.onShare?.(...args),
    onCallBack: (...args) => callbacksRef.current.onCallBack?.(...args),
  }), []);
  const closeActions = useCallback(() => setLongPressedMessageId(null), []);
  const openImagePreview = useCallback((url) => {
    setPreviewImage({ url, original_filename: "Image attachment" });
  }, []);
  const closeImagePreview = useCallback(() => setPreviewImage(null), []);
  const ignorePreviewChange = useCallback(() => {}, []);
  const previewMedia = useMemo(
    () => (previewImage ? [previewImage] : []),
    [previewImage]
  );

  const latestMessage = messages[messages.length - 1];
  const showLatestReceipt = Boolean(
    latestMessage
    && String(latestMessage.id) === String(
      latestConversationMessageId ?? latestMessage.id
    )
    && String(latestMessage.sender?.id ?? latestMessage.sender)
      === String(currentUser?.id)
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }, []);

  const startLongPress = useCallback((event, messageId) => {
    if (
      !event.target.closest?.(".message-bubble")
      || (event.type === "pointerdown" && event.pointerType === "mouse")
      || longPressTimer.current
    ) return;

    const touchPoint = event.touches?.[0];
    const x = Number.isFinite(event.clientX)
      ? event.clientX
      : touchPoint?.clientX || 0;
    const y = Number.isFinite(event.clientY)
      ? event.clientY
      : touchPoint?.clientY || 0;
    longPressOrigin.current = { x, y };
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressOrigin.current = null;
      window.navigator.vibrate?.(30);
      setLongPressedMessageId(messageId);
    }, MESSAGE_ACTION_HOLD_MS);
  }, []);

  const moveLongPress = useCallback((event) => {
    if (!longPressTimer.current || !longPressOrigin.current) return;
    const touchPoint = event.touches?.[0];
    const x = Number.isFinite(event.clientX)
      ? event.clientX
      : touchPoint?.clientX || 0;
    const y = Number.isFinite(event.clientY)
      ? event.clientY
      : touchPoint?.clientY || 0;
    if (
      Math.abs(x - longPressOrigin.current.x) > LONG_PRESS_MOVE_THRESHOLD
      || Math.abs(y - longPressOrigin.current.y) > LONG_PRESS_MOVE_THRESHOLD
    ) {
      cancelLongPress();
    }
  }, [cancelLongPress]);

  const startReplySwipe = useCallback((event, message) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch || !event.target.closest?.(".message-bubble")) {
      replySwipeOrigin.current = null;
      return;
    }

    replySwipeOrigin.current = {
      x: touch.clientX,
      y: touch.clientY,
      message,
    };
  }, []);

  const finishReplySwipe = useCallback((event) => {
    const origin = replySwipeOrigin.current;
    const touch = event.changedTouches?.[0];
    replySwipeOrigin.current = null;
    cancelLongPress();
    if (!origin || !touch) return;

    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (
      deltaX <= -REPLY_SWIPE_THRESHOLD
      && Math.abs(deltaY) <= REPLY_SWIPE_VERTICAL_LIMIT
    ) {
      setLongPressedMessageId(null);
      rowCallbacks.onReply(origin.message);
    }
  }, [cancelLongPress, rowCallbacks]);

  const cancelTouch = useCallback(() => {
    cancelLongPress();
    replySwipeOrigin.current = null;
  }, [cancelLongPress]);

  let previousDay = "";

  return (
    <>
      <div className="message-list" ref={listRef} onScroll={handleScroll}>
      {loadingOlder && <p className="message-history-loading" role="status">Loading older messages...</p>}
      {conversationPartner && (
        <section className="chat-profile-hero">
          <Avatar user={conversationPartner} size="large" />
          <h2>
            {[conversationPartner.first_name, conversationPartner.last_name]
              .filter(Boolean)
              .join(" ") || conversationPartner.username}
          </h2>
          <p>@{conversationPartner.username}</p>
          <Link
            to={`/profile/${conversationPartner.id}`}
            className="chat-view-profile"
          >
            {t("viewProfile")}
          </Link>
          {showVerificationWarning && (
            <p className="chat-verification-banner" role="alert">
              {t("messageVerificationWarning")}
            </p>
          )}
        </section>
      )}
      {messages.map((message) => {
        const timestamp = getTimestamp(message.created_at, language);
        const isCallLog = message.message_type === "call_log" || Boolean(message.call_id);
        const showReceipt = Boolean(
          String(message.sender?.id ?? message.sender) === String(currentUser?.id)
          && !isCallLog
          && showLatestReceipt
          && latestMessage.id === message.id
          && !message.upload_status
        );
        const showDateSeparator = timestamp && timestamp.day !== previousDay;
        if (timestamp) previousDay = timestamp.day;

        return (
          <Fragment key={message.id}>
            {showDateSeparator && (
              <div className="message-date-separator">
                <span>{timestamp.separator}</span>
              </div>
            )}
            <MessageItem
              key={message.id}
              message={message}
              currentUserId={currentUser?.id}
              conversationId={conversationId}
              showReceipt={showReceipt}
              canCallBack={Boolean(onCallBack)}
              actionsOpen={longPressedMessageId === message.id}
              onPointerDown={startLongPress}
              onPointerMove={moveLongPress}
              onCancelLongPress={cancelLongPress}
              onTouchStart={startLongPress}
              onMoveLongPress={moveLongPress}
              onTouchStartCapture={startReplySwipe}
              onTouchEnd={finishReplySwipe}
              onTouchCancel={cancelTouch}
              onReply={rowCallbacks.onReply}
              onEdit={rowCallbacks.onEdit}
              onDelete={rowCallbacks.onDelete}
              onShare={rowCallbacks.onShare}
              onCallBack={rowCallbacks.onCallBack}
              onCloseActions={closeActions}
              onPreviewImage={openImagePreview}
            />
          </Fragment>
        );
      })}

      <div ref={bottomRef} />
      </div>
      <MediaViewer
        media={previewMedia}
        index={0}
        onChange={ignorePreviewChange}
        onClose={closeImagePreview}
        ariaLabel="View chat image"
      />
    </>
  );
}