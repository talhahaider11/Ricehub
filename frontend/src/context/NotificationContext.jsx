import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import notificationService from "../services/notificationService";
import useAuth from "../hooks/useAuth";
import { getArrayResults } from "../utils/arrayResults";
import { ACCESS_TOKEN_KEY, WS_URL } from "../utils/constants";
import {
  getNotificationsEnabled,
  showSystemNotification,
} from "../services/systemNotificationService";

export const NotificationContext = createContext(null);

function getNotificationErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;

  const status = error.response?.status;
  if (status) return `${fallback} (HTTP ${status}).`;

  if (error.request) {
    return `${fallback} Check your connection and try again.`;
  }
  return fallback;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setTotalUnreadCount(0);
      setLoading(false);
      setError("");
      return;
    }

    try {
      setError("");
      const data = await notificationService.list();
      setNotifications(getArrayResults(data, "Notifications"));
      if (Number.isInteger(data.unread_count)) {
        setTotalUnreadCount(data.unread_count);
      }
    } catch (loadError) {
      console.error("Notifications could not be loaded:", loadError);
      setError(
        getNotificationErrorMessage(
          loadError,
          "Notifications could not be loaded. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setTotalUnreadCount(0);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    loadNotifications();

    const interval = window.setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [user, loadNotifications]);

  useEffect(() => {
    const refreshOnPush = () => loadNotifications();
    window.addEventListener("ricemarket:notifications-refresh", refreshOnPush);
    return () => {
      window.removeEventListener("ricemarket:notifications-refresh", refreshOnPush);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id || typeof WebSocket === "undefined") return undefined;
    let active = true;
    let socket;
    let reconnectTimer;
    let reconnectDelay = 1000;

    const connect = () => {
      if (!active || !getNotificationsEnabled()) return;
      const token = localStorage.getItem(ACCESS_TOKEN_KEY)
        || localStorage.getItem("access_token");
      if (!token) return;

      try {
        socket = new WebSocket(
          `${WS_URL}/notifications/?token=${encodeURIComponent(token)}`
        );
      } catch (socketError) {
        console.error("Notification WebSocket could not be opened:", socketError);
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
        return;
      }

      socket.onopen = () => {
        reconnectDelay = 1000;
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "notification" || !data.notification) return;
          const item = data.notification;
          void loadNotifications();
          const currentConversationId = new URLSearchParams(
            window.location.search
          ).get("conversation_id");
          const viewingConversation = (
            Boolean(item.conversation_id)
            &&
            document.visibilityState === "visible"
            && window.location.pathname.startsWith("/messages")
            && String(currentConversationId) === String(item.conversation_id)
          );
          const viewingNotifications = (
            document.visibilityState === "visible"
            && window.location.pathname.startsWith("/notifications")
          );
          if (viewingConversation || viewingNotifications) return;
          void showSystemNotification({
            id: item.call_id ? `call-${item.call_id}` : item.id,
            title: item.sender_name || "RiceHub",
            body: item.message || "You have a new notification.",
            data: {
              notification_id: item.id,
              notification_type: item.type,
              sender_id: item.sender_id,
              conversation_id: item.conversation_id,
              post_id: item.post_id,
              comment_id: item.comment_id,
              call_id: item.call_id,
            },
          });
        } catch (socketError) {
          console.error("Notification WebSocket message could not be read:", socketError);
        }
      };
      socket.onerror = () => {
        socket?.close();
      };
      socket.onclose = () => {
        if (!active || !getNotificationsEnabled()) return;
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
      };
    };

    const updateSocketForPreference = () => {
      if (getNotificationsEnabled()) {
        if (!socket || socket.readyState === WebSocket.CLOSED) connect();
        return;
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    };

    connect();
    window.addEventListener(
      "ricehub:notification-setting-changed",
      updateSocketForPreference
    );
    return () => {
      active = false;
      window.removeEventListener(
        "ricehub:notification-setting-changed",
        updateSocketForPreference
      );
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [user?.id, loadNotifications]);

  const unreadCount =
    totalUnreadCount ?? notifications.filter((item) => !item.is_read).length;

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
    } catch (markError) {
      setError(
        getNotificationErrorMessage(
          markError,
          "Notification could not be marked as read."
        )
      );
      throw markError;
    }

    const wasUnread = notifications.some(
      (item) => item.id === id && !item.is_read
    );
    if (wasUnread) {
      setTotalUnreadCount((count) =>
        count === null ? null : Math.max(0, count - 1)
      );
    }
    setNotifications((current) =>
      current.map((item) =>
        item.id === id? {...item, is_read: true } : item
      )
    );
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
    } catch (markError) {
      setError(
        getNotificationErrorMessage(
          markError,
          "Notifications could not be marked as read."
        )
      );
      throw markError;
    }

    setNotifications((current) =>
      current.map((item) => ({...item, is_read: true }))
    );
    setTotalUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        error,
        unreadCount,
        markRead,
        markAllRead,
        refresh: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}