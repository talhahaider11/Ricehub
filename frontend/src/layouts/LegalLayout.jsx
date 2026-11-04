import { Link, Outlet } from "react-router-dom";

export default function LegalLayout() {
  return (
    <div className="legal-layout">
      <header className="legal-nav">
        <Link className="legal-brand" to="/">
          RiceHub
        </Link>
        <nav aria-label="Legal and account pages">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/delete-account">Delete account</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>
      <Outlet />
      <footer className="legal-footer">
        <span>RiceHub</span>
        <Link to="/help-support">Help &amp; Support</Link>
      </footer>
    </div>
  );
}
