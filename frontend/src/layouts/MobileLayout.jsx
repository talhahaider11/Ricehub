import {
  Home,
  Users,
  MessageCircle,
  Bell,
  Compass,
  UserPlus,
  Store,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import useAuth from "../hooks/useAuth";

export default function MobileLayout() {
  const links = [
    { path: "/", icon: Home },
    { path: "/search", icon: Compass },
    { path: "/discover", icon: Store },
    { path: "/friends", icon: Users },
    { path: "/friend-requests", icon: UserPlus },
    { path: "/messages", icon: MessageCircle },
    { path: "/notifications", icon: Bell },
  ];

  return (
    <nav className="mobile-nav">
      {links.map(({ path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " active" : ""}`
          }
        >
          <Icon size={22} />
        </NavLink>
      ))}
    </nav>
  );
}
