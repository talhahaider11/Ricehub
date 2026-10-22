import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Compass,
  HelpCircle,
  Home,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "../common/Avatar";
import { useTheme } from "../../context/ThemeContext";
import useAuth from "../../hooks/useAuth";

const primaryLinks = [
  { label: "Home", path: "/", icon: Home },
  { label: "Friends", path: "/friends", icon: Users },
  { label: "Messages", path: "/messages", icon: MessageCircle },
];

const additionalLinks = [
  { label: "Discover", path: "/discover", icon: Compass },
  { label: "Friend requests", path: "/friend-requests", icon: UserPlus },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Search", path: "/search", icon: Search },
];

function displayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return name || user?.username || "Your account";
}

export default function MobileMenu({ onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const currentLocation = `${location.pathname}${location.search}`;
  const previousLocationRef = useRef(currentLocation);
  const [expandedSections, setExpandedSections] = useState({
    more: false,
    support: false,
    settings: false,
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (previousLocationRef.current !== currentLocation) {
      previousLocationRef.current = currentLocation;
      onClose();
    }
  }, [currentLocation, onClose]);

  const toggleSection = (section) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const handleLogout = () => {
    logout();
    onClose();
    navigate("/login");
  };

  const name = displayName(user);
  const profilePath = `/profile/${user?.id}`;

  return (
    <>
      <button
        className="mobile-menu-backdrop"
        type="button"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        className="mobile-menu"
        id="ricehub-mobile-menu"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="RiceHub menu"
      >
        <div className="mobile-menu-profile">
          <Link className="mobile-menu-account" to={profilePath} onClick={onClose}>
            <Avatar src={user?.profile_picture} name={name} size={42} />
            <span>
              <strong>{name}</strong>
              <small>View your profile</small>
            </span>
          </Link>
          <Link
            className="mobile-menu-profile-edit"
            to="/profile/edit"
            onClick={onClose}
            aria-label="Edit profile"
          >
            <Settings size={18} />
          </Link>
          <button
            ref={closeButtonRef}
            className="mobile-menu-profile-edit"
            type="button"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mobile-menu-links" aria-label="Main menu">
          {primaryLinks.map(({ label, path, icon: Icon }) => (
            <Link key={path} to={path} onClick={onClose}>
              <Icon size={21} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="mobile-menu-expand"
          aria-expanded={expandedSections.more}
          onClick={() => toggleSection("more")}
        >
          {expandedSections.more ? "See less" : "See more"}
          <ChevronDown size={18} aria-hidden="true" />
        </button>

        {expandedSections.more && (
          <nav className="mobile-menu-links mobile-menu-extra" aria-label="More">
            {additionalLinks.map(({ label, path, icon: Icon }) => (
              <Link key={path} to={path} onClick={onClose}>
                <Icon size={21} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}

        <section className="mobile-menu-section">
          <button
            type="button"
            className="mobile-menu-section-toggle"
            aria-expanded={expandedSections.support}
            onClick={() => toggleSection("support")}
          >
            <span><HelpCircle size={20} /> Help and support</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {expandedSections.support && (
            <div className="mobile-menu-help">
              <p>Find privacy, sign-in and account controls in Settings.</p>
              <Link to="/settings" onClick={onClose}>Open settings</Link>
            </div>
          )}
        </section>

        <section className="mobile-menu-section">
          <button
            type="button"
            className="mobile-menu-section-toggle"
            aria-expanded={expandedSections.settings}
            onClick={() => toggleSection("settings")}
          >
            <span><Settings size={20} /> Settings and privacy</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {expandedSections.settings && (
            <div className="mobile-menu-subitems">
              <Link to="/settings" onClick={onClose}>
                <Settings size={19} />
                <span>Settings</span>
              </Link>
              <Link to="/settings#privacy" onClick={onClose}>
                <Shield size={19} />
                <span>Privacy and audience</span>
              </Link>
              <Link to="/settings#security" onClick={onClose}>
                <LockKeyhole size={19} />
                <span>Security and login</span>
              </Link>
              <Link to="/settings#appearance" onClick={onClose}>
                {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
                <span>Appearance</span>
              </Link>
              <button type="button" onClick={toggleTheme}>
                {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
                <span>Turn {theme === "light" ? "dark" : "light"} mode on</span>
              </button>
            </div>
          )}
        </section>

        <button type="button" className="mobile-menu-logout" onClick={handleLogout}>
          <LogOut size={19} />
          <span>Log out</span>
        </button>
        <footer className="mobile-menu-footer">RiceHub · Connect · Share · Belong</footer>
      </aside>
    </>
  );
}
