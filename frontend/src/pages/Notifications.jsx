import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationContext } from "../context/NotificationContext";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import { getNotificationPath } from "../utils/notificationNavigation";
import { useLanguage } from "../context/LanguageContext";

export default function Notifications() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAllRead,
    markRead,
    refresh,
  } = useContext(NotificationContext);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch {
      // The context exposes the action error in the page.
    }
  };

  const handleMarkRead = async (notification) => {
    try {
      await markRead(notification.id);
    } catch {
      return;
    }
    navigate(getNotificationPath(notification));
  };

  return (
    <div className="page-container">

      <div className="page-heading">
        <h1>{t("notifications")}</h1>

        <Button
          variant="secondary"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          {t("notificationMarkAllRead")}
        </Button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
          <Button variant="secondary" onClick={refresh}>
            {t("retry")}
          </Button>
        </div>
      )}

      {loading ? (
        <Loader />
      ) : notifications.length === 0 ? (
        <EmptyState
          title={t("allCaughtUp")}
          message={t("newNotificationsHere")}
        />
      ) : (
        <div className="notification-list">

          {notifications.map(
            (notification) => (
              <button
                key={notification.id}
                className={
                  notification.is_read
                    ? "notification read"
                    : "notification unread"
                }
                onClick={() => handleMarkRead(notification)}
              >
                <span className="notification-details">
                  <strong>
                    {notification.sender
                      ? [notification.sender.first_name, notification.sender.last_name]
                          .filter(Boolean)
                          .join(" ") || notification.sender.username
                      : t("riceHubMember")}
                  </strong>
                  <small className="notification-type">
                    {notification.notification_type_label ||
                      notification.notification_type.replace(/_/g, " ")}
                  </small>
                  <span>{notification.message}</span>
                </span>

                <small>
                  {new Date(
                    notification.created_at
                  ).toLocaleString()}
                </small>
              </button>
            )
          )}

        </div>
      )}
    </div>
    
  );
}
