import {
  Bell,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

export default function NotificationBell({
  count = 0,
}) {
  return (
    <Link
      to="/notifications"
      className="icon-button"
      aria-label="Notifications"
    >
      <Bell size={21} />

      {count > 0 && (
        <span className="notification-badge">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}