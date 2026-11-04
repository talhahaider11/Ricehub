import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/admin/StatCard";
import Loader from "../../components/common/Loader";
import adminService from "../../services/adminService";
import { API_URL } from "../../utils/constants";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminService.getDashboard()
      .then((response) => {
        if (active) setData(response);
      })
      .catch((loadError) => {
        console.error("Admin dashboard could not be loaded:", loadError);
        if (active) setError("Dashboard statistics could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!data && !error) return <Loader />;

  return (
    <section>
      <header className="admin-page-heading">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Platform activity and moderation overview.</p>
        </div>
        <a
          className="btn btn-secondary"
          href={`${API_URL.replace(/\/api\/?$/i, "")}/admin/`}
          target="_blank"
          rel="noreferrer"
        >
          Django admin
        </a>
      </header>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {data && (
        <>
          <div className="admin-overview-grid">
            <StatCard title="Total users" value={data.users.total} />
            <StatCard title="Active users" value={data.users.active} />
            <StatCard title="New today" value={data.users.new_today} />
            <StatCard title="Posts" value={data.content.posts} />
            <StatCard title="Comments" value={data.content.comments} />
            <StatCard title="Messages" value={data.messages.total} />
            <StatCard title="Pending reports" value={data.reports.pending} />
          </div>
          <div className="admin-quick-links">
            <Link className="btn btn-secondary" to="/admin/users">Manage users</Link>
            <Link className="btn btn-secondary" to="/admin/reports">Review reports</Link>
            <Link className="btn btn-secondary" to="/admin/posts">Manage posts</Link>
          </div>
        </>
      )}
    </section>
  );
}
