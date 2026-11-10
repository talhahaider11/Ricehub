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
  Settings,
  Shield,
  Store,
  Sun,
  TrendingUp,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Avatar from "../common/Avatar";
import { useTheme } from "../../context/ThemeContext";
import useAuth from "../../hooks/useAuth";
import { useLanguage } from "../../context/LanguageContext";

const primaryLinks = [
  { label: "home", path: "/", icon: Home },
  { label: "messages", path: "/messages", icon: MessageCircle },
  { label: "suggestions", path: "/suggestions", icon: UsersRound },
];

const additionalLinks = [
  { label: "discover", path: "/discover?tab=Stories", icon: Compass },
  { label: "marketplace", path: "/marketplace", icon: Store },
  { label: "explore", path: "/explore", icon: TrendingUp },
  { label: "friendRequests", path: "/friend-requests", icon: UserPlus },
  { label: "notifications", path: "/notifications", icon: Bell },
  { label: "getVerified", path: "/billing", icon: Shield },
];

function displayName(user, fallback) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return name || user?.username || fallback;
}

export default function MobileMenu({ onClose }) {
  const { t } = useLanguage();
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
    import("../../pages/SocialHub").catch((error) => {
      console.error("Discover page could not be prefetched:", error);
    });
    import("../../pages/Messages").catch((error) => {
      console.error("Messages page could not be prefetched:", error);
    });
  }, []);

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

  const name = displayName(user, t("yourAccount"));
  const profilePath = `/profile/${user?.id}`;

  return (
    <>
      <button
        className="mobile-menu-backdrop"
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
      />
      <aside
        className="mobile-menu"
        id="ricehub-mobile-menu"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("riceHubMenu")}
      >
        <div className="mobile-menu-profile">
          <Link className="mobile-menu-account" to={profilePath} onClick={onClose}>
            <Avatar src={user?.profile_picture} name={name} size={42} />
            <span>
              <strong>{name}</strong>
              <small>{t("yourProfile")}</small>
            </span>
          </Link>
          <Link
            className="mobile-menu-profile-edit"
            to="/profile/edit"
            onClick={onClose}
            aria-label={t("editProfile")}
          >
            <Settings size={18} />
          </Link>
          <button
            ref={closeButtonRef}
            className="mobile-menu-profile-edit"
            type="button"
            aria-label={t("closeMenu")}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mobile-menu-links" aria-label={t("mainMenu")}>
          {primaryLinks.map(({ label, path, icon: Icon }) => (
            <Link key={path} to={path} onClick={onClose}>
              <Icon size={21} />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>

        {expandedSections.more && (
          <div className="mobile-menu-extra-section">
            <nav className="mobile-menu-links mobile-menu-extra" aria-label={t("more")}>
              {additionalLinks.map(({ label, path, icon: Icon }) => (
                <Link key={path} to={path} onClick={onClose}>
                  <Icon size={21} />
                  <span>{t(label)}</span>
                </Link>
              ))}
              {user?.is_staff && (
                <Link to="/admin" onClick={onClose}>
                  <Shield size={21} />
                  <span>{t("administration")}</span>
                </Link>
              )}
            </nav>
            <button
              type="button"
              className="mobile-menu-expand"
              aria-expanded="true"
              onClick={() => toggleSection("more")}
            >
              {t("seeLess")}
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {!expandedSections.more && (
          <button
            type="button"
            className="mobile-menu-expand"
            aria-expanded="false"
            onClick={() => toggleSection("more")}
          >
            {t("seeMore")}
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        )}

        <section className="mobile-menu-section">
          <button
            type="button"
            className="mobile-menu-section-toggle"
            aria-expanded={expandedSections.support}
            onClick={() => toggleSection("support")}
          >
            <span><HelpCircle size={20} /> {t("helpSupport")}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {expandedSections.support && (
            <div className="mobile-menu-help">
              <p>{t("browseHelp")}</p>
              <Link to="/help-support" onClick={onClose}>{t("openHelp")}</Link>
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
            <span><Settings size={20} /> {t("settingsPrivacy")}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {expandedSections.settings && (
            <div className="mobile-menu-subitems">
              <Link to="/settings" onClick={onClose}>
                <Settings size={19} />
                <span>{t("settings")}</span>
              </Link>
              <Link to="/settings#privacy" onClick={onClose}>
                <Shield size={19} />
                <span>{t("privacyAudience")}</span>
              </Link>
              <Link to="/settings#security" onClick={onClose}>
                <LockKeyhole size={19} />
                <span>{t("securityLogin")}</span>
              </Link>
              <button type="button" onClick={toggleTheme}>
                {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
                <span>{t("appearance", { mode: t(theme === "light" ? "dark" : "light") })}</span>
              </button>
            </div>
          )}
        </section>

        <button type="button" className="mobile-menu-logout" onClick={handleLogout}>
          <LogOut size={19} />
          <span>{t("logOut")}</span>
        </button>
        <footer className="mobile-menu-footer">{t("riceHubSlogan")}</footer>
      </aside>
    </>
  );
}
