import { NavLink } from "react-router-dom";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/posts", label: "Posts" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <h2>RiceHub Admin</h2>
      <nav aria-label="Administration">
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `admin-sidebar-link${isActive ? " active" : ""}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
