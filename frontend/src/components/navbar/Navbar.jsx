import {
  Home,
  Users,
  MessageCircle,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import { useCallback, useContext, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "../common/ThemeToggle";
import MobileMenu from "./MobileMenu";
import useAuth from "../../hooks/useAuth";
import { NotificationContext } from "../../context/NotificationContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useContext(NotificationContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    mobileMenuTriggerRef.current?.focus();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          RiceHub
        </Link>

        <SearchBar />

        <nav className="navbar-links">
          <Link to="/" aria-label="Home">
            <Home size={20} />
            <span>Home</span>
          </Link>

          <Link to="/friends" aria-label="Friends">
            <Users size={20} />
            <span>Friends</span>
          </Link>

          <Link to="/messages" aria-label="Open messages">
            <MessageCircle size={20} />
            <span>Messages</span>
          </Link>

          <NotificationBell count={unreadCount} />

          <Link
            to={`/profile/${user?.id}`}
            className="profile-nav navbar-account"
            aria-label="Your account"
            title="Your account"
          >
            <UserRound size={20} aria-hidden="true" />
          </Link>

          <Link to="/settings" aria-label="Open settings">
            <Settings size={20} />
          </Link>

          <ThemeToggle />

          <button
            className="icon-button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </nav>

        <button
          ref={mobileMenuTriggerRef}
          className="mobile-menu-trigger icon-button"
          type="button"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={mobileMenuOpen}
          aria-controls="ricehub-mobile-menu"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={21} />
        </button>
      </div>
      {mobileMenuOpen && <MobileMenu onClose={closeMobileMenu} />}
    </header>
  );
}