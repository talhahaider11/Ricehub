import {
  Home,
  MessageCircle,
  Bell,
  UserPlus,
  Store,
  UserRound,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useLanguage } from "../context/LanguageContext";
import useAuth from "../hooks/useAuth";

export default function MobileLayout() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const links = [
    { path: "/", icon: Home, label: "home" },
    { path: "/discover?tab=Marketplace", icon: Store, label: "marketplace" },
    { path: "/friend-requests", icon: UserPlus, label: "friendRequests" },
    { path: "/messages", icon: MessageCircle, label: "messages" },
    { path: "/notifications", icon: Bell, label: "notifications" },
    {
      path: user?.id ? `/profile/${user.id}` : "/",
      icon: UserRound,
      label: "profile",
    },
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
          aria-label={label === "profile" ? "Profile" : t(label)}
          title={label === "profile" ? "Profile" : t(label)}
        >
          <Icon size={21} aria-hidden="true" />
          {label === "profile" && <span>Profile</span>}
        </NavLink>
      ))}
    </nav>
  );
}
