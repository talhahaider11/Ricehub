import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import notificationService from "../services/notificationService";
import useAuth from "../hooks/useAuth";

export const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      setError("");
      return;
    }

    try {
      setError("");
      const data = await notificationService.list();
      setNotifications(data.results || data);
    } catch {
      setError("Notifications could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
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

  const unreadCount = notifications.filter((item) =>!item.is_read).length;

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
    } catch (markError) {
      setError("Notification could not be marked as read.");
      throw markError;
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
      setError("Notifications could not be marked as read.");
      throw markError;
    }

    setNotifications((current) =>
      current.map((item) => ({...item, is_read: true }))
    );
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