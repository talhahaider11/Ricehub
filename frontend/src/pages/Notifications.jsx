import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";

export default function Notifications() {
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

  const handleMarkRead = async (id) => {
    try {
      await markRead(id);
    } catch {
      // The context exposes the action error in the page.
    }
  };

  return (
    <div className="page-container">

      <div className="page-heading">
        <h1>Notifications</h1>

        <Button
          variant="secondary"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          Mark all read
        </Button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
          <Button variant="secondary" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <Loader />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          message="New notifications will appear here."
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
                onClick={() => handleMarkRead(notification.id)}
              >
                <strong>
                  {notification.message}
                </strong>

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
