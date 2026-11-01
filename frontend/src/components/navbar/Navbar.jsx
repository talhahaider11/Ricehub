import {
  Home,
  Users,
  MessageCircle,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { useCallback, useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openUpload = () => {
    if (location.pathname !== "/") {
      navigate("/", { state: { openCreateMenu: true } });
      return;
    }
    window.dispatchEvent(new Event("ricehub:open-create-menu"));
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button
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

        <Link to="/" className="brand">
          <img src="/ricehub-logo.jpg" alt="RiceHub" />
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

          <Link to="/search" aria-label="Search" title="Search">
            <Search size={20} />
            <span>Search</span>
          </Link>

          <button
            type="button"
            className="navbar-upload"
            onClick={openUpload}
            aria-label="Upload or create"
            title="Upload or create"
          >
            <Plus size={20} />
            <span>Upload</span>
          </button>

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

      </div>
      {mobileMenuOpen && <MobileMenu onClose={closeMobileMenu} />}
    </header>
  );
}