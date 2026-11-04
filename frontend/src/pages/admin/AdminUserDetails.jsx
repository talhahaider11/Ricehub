import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import StatusBadge from "../../components/admin/StatusBadge";
import ErrorState from "../../components/common/ErrorState";
import Loader from "../../components/common/Loader";
import useAuth from "../../hooks/useAuth";
import adminService from "../../services/adminService";

export default function AdminUserDetails() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadUser = async () => {
    setError("");
    try {
      setUser(await adminService.getUser(id));
    } catch (loadError) {
      console.error("Admin user details could not be loaded:", loadError);
      setError("User details could not be loaded.");
    }
  };

  useEffect(() => {
    loadUser();
  }, [id]);

  const changeStatus = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      if (user.is_suspended) {
        await adminService.unsuspendUser(user.id);
      } else {
        if (!reason.trim()) {
          setError("Enter a reason before suspending this account.");
          setBusy(false);
          return;
        }
        await adminService.suspendUser(user.id, reason.trim());
      }
      setConfirmOpen(false);
      setReason("");
      await loadUser();
    } catch (actionError) {
      console.error("Admin account status could not be changed:", actionError);
      setError(
        actionError.response?.data?.detail
          || actionError.response?.data?.reason?.[0]
          || "Account status could not be changed."
      );
    } finally {
      setBusy(false);
    }
  };

  if (!user && !error) return <Loader />;

  return (
    <section>
      <p><Link to="/admin/users">← Back to users</Link></p>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {user && (
        <>
          <header className="admin-page-heading">
            <div>
              <h1>{user.first_name || user.username}</h1>
              <p className="muted">@{user.username}</p>
            </div>
            <StatusBadge status={user.is_suspended ? "suspended" : user.is_active ? "active" : "inactive"} />
          </header>
          <dl className="admin-detail-list">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Joined</dt><dd>{new Date(user.date_joined || user.created_at).toLocaleString()}</dd></div>
            <div><dt>Last login</dt><dd>{user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}</dd></div>
            <div><dt>Posts</dt><dd>{user.post_count}</dd></div>
            <div><dt>Friends</dt><dd>{user.friend_count}</dd></div>
            {user.is_suspended && <div><dt>Suspension reason</dt><dd>{user.suspension_reason || "Not provided"}</dd></div>}
          </dl>
          <button
            className={user.is_suspended ? "btn btn-secondary" : "btn btn-danger"}
            type="button"
            disabled={user.is_superuser || user.id === currentUser?.id}
            onClick={() => setConfirmOpen(true)}
          >
            {user.is_suspended ? "Unsuspend user" : "Suspend user"}
          </button>
          <ConfirmActionModal
            open={confirmOpen}
            title={user.is_suspended ? "Unsuspend account" : "Suspend account"}
            message={`Confirm this status change for @${user.username}.`}
            confirmLabel={user.is_suspended ? "Unsuspend" : "Suspend"}
            busy={busy}
            destructive={!user.is_suspended}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={changeStatus}
          >
            {!user.is_suspended && (
              <label>
                Reason
                <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
          </ConfirmActionModal>
        </>
      )}
    </section>
  );
}
