import {
  Home,
  MessageCircle,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
} from "lucide-react";
import { useCallback, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const prefersReducedMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openCreate = (type) => {
    setCreateMenuOpen(false);
    navigate(`/create?type=${type}`);
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
          <span>Rice Hub</span>
        </Link>

        <nav className="navbar-links">
          <Link to="/" aria-label="Home">
            <Home size={20} />
            <span>Home</span>
          </Link>

          <Link to="/messages" aria-label="Open messages">
            <MessageCircle size={20} />
            <span>Messages</span>
          </Link>

          <NotificationBell count={unreadCount} />

          <SearchBar />

          <div className="navbar-create-menu">
            <button
              type="button"
              className="navbar-upload"
              onClick={() => setCreateMenuOpen((open) => !open)}
              aria-label="Upload or create"
              aria-expanded={createMenuOpen}
              aria-haspopup="menu"
              title="Upload or create"
            >
              <Plus size={20} />
              <span>Upload</span>
            </button>
            <AnimatePresence>
              {createMenuOpen && (
                <motion.div
                  className="navbar-create-dropdown"
                  role="menu"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
                >
                  {["post", "story", "reel"].map((type) => (
                    <motion.button
                      key={type}
                      type="button"
                      role="menuitem"
                      onClick={() => openCreate(type)}
                      whileHover={prefersReducedMotion ? undefined : { x: 3 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    >
                      {type[0].toUpperCase() + type.slice(1)}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link to="/settings" aria-label="Open settings">
            <Settings size={20} />
          </Link>

          {user?.is_staff && (
            <Link to="/admin" aria-label="Open administration dashboard">
              <Shield size={20} />
              <span>Moderation</span>
            </Link>
          )}

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