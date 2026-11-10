import {
  Bell,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function NotificationBell({
  count = 0,
}) {
  const { t } = useLanguage();
  return (
    <Link
      to="/notifications"
      className="icon-button"
      aria-label={t("notifications")}
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