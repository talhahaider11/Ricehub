import { Link, Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <aside className="auth-visual" aria-hidden="true">
        <Link to="/" className="auth-visual-brand">
          <span className="auth-logo-mark">WF</span>
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
          <span className="auth-logo-mark">WF</span>
          <strong>RiceHub</strong>
        </div>
        <Outlet />
      </section>
    </div>
  );
}