import {
  Home,
  MessageCircle,
  Bell,
  UserPlus,
  Store,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useLanguage } from "../context/LanguageContext";

export default function MobileLayout() {
  const { t } = useLanguage();
  const links = [
    { path: "/", icon: Home, label: "home" },
    { path: "/discover?tab=Marketplace", icon: Store, label: "marketplace" },
    { path: "/friend-requests", icon: UserPlus, label: "friendRequests" },
    { path: "/messages", icon: MessageCircle, label: "messages" },
    { path: "/notifications", icon: Bell, label: "notifications" },
  ];

  return (
    <nav className="mobile-nav">
      {links.map(({ path, icon: Icon, label }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " active" : ""}`
          }
          aria-label={t(label)}
          title={t(label)}
        >
          <Icon size={22} />
        </NavLink>
      ))}
    </nav>
  );
}
