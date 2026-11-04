import { Link } from "react-router-dom";

export default function AdminSettings() {
  return (
    <section>
      <header className="admin-page-heading">
        <div>
          <h1>Administration settings</h1>
          <p className="muted">Operational safeguards for the staff console.</p>
        </div>
      </header>
      <div className="card admin-settings-card">
        <h2>Access and audit</h2>
        <ul>
          <li>Admin API requests require staff access on the backend.</li>
          <li>Suspensions, deletions, and report decisions are audited.</li>
          <li>Passwords, access tokens, and secret values are not shown here.</li>
        </ul>
        <p>
          Deployment secrets and runtime settings must be changed in the hosting
          provider, not through this browser page. Manage people in <Link to="/admin/users">Users</Link>.
        </p>
      </div>
    </section>
  );
}
