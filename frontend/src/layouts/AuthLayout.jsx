import { Link } from "react-router-dom";
import PageTransition from "../components/common/PageTransition";

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <aside className="auth-visual" aria-hidden="true">
        <Link to="/" className="auth-visual-brand">
          <img className="auth-logo-image" src="/ricehub-logo.jpg" alt="" />
          <span>
            <strong>RiceHub</strong>
            <small>Connect · Share · Belong</small>
          </span>
        </Link>
        <div className="auth-art" aria-hidden="true">
          <span className="auth-art-sun" />
          <span className="auth-art-orbit auth-art-orbit-one" />
          <span className="auth-art-orbit auth-art-orbit-two" />
          <span className="auth-art-person auth-art-person-one" />
          <span className="auth-art-person auth-art-person-two" />
          <span className="auth-art-person auth-art-person-three" />
          <span className="auth-art-ground" />
        </div>
        <p className="auth-visual-caption">
          A little closer, wherever life takes you.
        </p>
      </aside>

      <section className="auth-content">
        <div className="auth-mobile-brand">
          <img className="auth-logo-image" src="/ricehub-logo.jpg" alt="" />
          <strong>RiceHub</strong>
        </div>
        <PageTransition />
        <nav className="auth-legal-links" aria-label="Legal">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/delete-account">Delete Account</Link>
        </nav>
      </section>
    </div>
  );
}