import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function UserTable({ users, emptyMessage = "No users found." }) {
  if (!users.length) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const status = user.is_suspended
              ? "suspended"
              : user.is_active ? "active" : "inactive";
            return (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>@{user.username}</td>
                <td>{user.email}</td>
                <td><StatusBadge status={status} /></td>
                <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</td>
                <td><Link to={`/admin/users/${user.id}`}>View</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
