import {
  Bell,
  UserPlus,
  Home,
  MessageCircle,
  Settings,
  Compass,
  HelpCircle,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const items = [
  {
    label: "Home",
    path: "/",
    icon: Home,
  },
  {
    label: "Discover",
    path: "/discover",
    icon: Compass,
  },
  {
    label: "Messages",
    path: "/messages",
    icon: MessageCircle,
  },
  {
    label: "Friend requests",
    path: "/friend-requests",
    icon: UserPlus,
  },
  {
    label: "Notifications",
    path: "/notifications",
    icon: Bell,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
  {
    label: "Help and support",
    path: "/help-support",
    icon: HelpCircle,
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-item ${
                isActive ? "active" : ""
              }`
            }
          >
            <Icon size={21} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </aside>
  );
}