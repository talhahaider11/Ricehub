import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function AdminHeader() {
  const { user } = useAuth();

  return (
    <header className="admin-header">
      <Link to="/" className="admin-header-brand">RiceHub administration</Link>
      <span>{user?.username ? `Signed in as @${user.username}` : "Staff access"}</span>
    </header>
  );
}
