import { useEffect, useState } from "react";
import UserTable from "../../components/admin/UserTable";
import ErrorState from "../../components/common/ErrorState";
import Loader from "../../components/common/Loader";
import adminService from "../../services/adminService";
import { getArrayResults } from "../../utils/arrayResults";

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await adminService.getUsers({
        q: query.trim(),
        status,
      });
      setUsers(getArrayResults(response, "Admin users"));
    } catch (loadError) {
      console.error("Admin users could not be loaded:", loadError);
      setError("Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <section>
      <header className="admin-page-heading">
        <div>
          <h1>Users</h1>
          <p className="muted">Search accounts and inspect account status.</p>
        </div>
      </header>
      <form className="admin-filter-form" onSubmit={loadUsers}>
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Username, name, or email"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All accounts</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>Search</button>
      </form>
      {loading ? <Loader /> : error ? (
        <ErrorState message={error} onRetry={loadUsers} />
      ) : (
        <UserTable users={users} />
      )}
    </section>
  );
}
