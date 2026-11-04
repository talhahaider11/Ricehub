import { useCallback, useEffect, useState } from "react";
import moderationService from "../services/moderationService";
import { getArrayResults } from "../utils/arrayResults";
import Loader from "../components/common/Loader";
import { API_URL } from "../utils/constants";
import useAuth from "../hooks/useAuth";

const reviewStatuses = [
  ["reviewed", "Mark reviewed"],
  ["action_taken", "Action taken"],
  ["dismissed", "Dismiss"],
];

export default function AdminDashboard() {
  const auth = useAuth();
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [accountReports, setAccountReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userStatus, setUserStatus] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [suspendedFilter, setSuspendedFilter] = useState("all");
  const [suspensionReason, setSuspensionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [error, setError] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [accountNotes, setAccountNotes] = useState({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        overviewData,
        reportData,
        accountReportData,
        userData,
        analyticsData,
      ] = await Promise.all([
        moderationService.getAdminOverview(),
        moderationService.getContentReports("open"),
        moderationService.getAccountReports("open"),
        moderationService.getAdminUsers({ status: "all" }),
        moderationService.getUserAnalytics(),
      ]);
      setOverview(overviewData);
      setReports(getArrayResults(reportData, "Reports"));
      setAccountReports(getArrayResults(accountReportData, "Account reports"));
      setUsers(getArrayResults(userData, "Users"));
      setAnalytics(analyticsData);
    } catch (loadError) {
      setError(
        loadError.response?.status === 403
          ? "Staff access is required to view the moderation dashboard."
          : "The moderation dashboard could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const reviewReport = async (reportId, status) => {
    const actionKey = `content-report-${reportId}`;
    setSavingAction(actionKey);
    setError("");
    try {
      await moderationService.updateContentReport(reportId, {
        status,
        resolution_note: resolutionNotes[reportId] || "",
      });
      await loadDashboard();
    } catch {
      setError("The report could not be updated.");
    } finally {
      setSavingAction("");
    }
  };

  const reviewAccountReport = async (reportId) => {
    setSavingAction(`account-report-${reportId}`);
    setError("");
    try {
      await moderationService.updateAccountReport(reportId, {
        status: "reviewed",
        moderator_notes: accountNotes[reportId] || "",
      });
      await loadDashboard();
    } catch {
      setError("The account report could not be updated.");
    } finally {
      setSavingAction("");
    }
  };

  const searchUsers = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await moderationService.getAdminUsers({
        status: userStatus,
        q: userSearch.trim(),
        ...(staffFilter !== "all" && { staff: staffFilter }),
        ...(suspendedFilter !== "all" && { suspended: suspendedFilter }),
      });
      setUsers(getArrayResults(data, "Users"));
    } catch {
      setError("Users could not be loaded.");
    }
  };

  const changeUserStatus = async (user) => {
    setSavingAction(`user-${user.id}`);
    setError("");
    try {
      if (user.is_suspended) {
        await moderationService.unsuspendUser(user.id);
      } else {
        await moderationService.suspendUser(
          user.id,
          suspensionReason.trim()
        );
      }
      await loadDashboard();
    } catch (actionError) {
      setError(
        actionError.response?.data?.detail ||
          actionError.response?.data?.reason?.[0] ||
          "The account status could not be changed."
      );
    } finally {
      setSavingAction("");
    }
  };

  const deleteUser = async (user) => {
    if (
      user.is_superuser
      || user.id === auth?.user?.id
      || !window.confirm(`Permanently delete @${user.username}?`)
    ) {
      return;
    }

    setSavingAction(`user-${user.id}`);
    setError("");
    try {
      await moderationService.deleteUser(
        user.id,
        "Deleted by a staff member from the administration dashboard."
      );
      await loadDashboard();
    } catch {
      setError("The account could not be deleted.");
    } finally {
      setSavingAction("");
    }
  };

  if (loading) return <Loader />;

  return (
    <section className="page-container settings-page">
      <header className="admin-dashboard-header">
        <h1>Moderation dashboard</h1>
        <a
          className="btn btn-secondary"
          href={`${API_URL.replace(/\/api\/?$/i, "")}/admin/`}
          target="_blank"
          rel="noreferrer"
        >
          Open Django admin
        </a>
      </header>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {overview && (
        <div className="admin-overview-grid">
          {[
            ["Users", overview.users],
            ["Active users", overview.active_users],
            ["New users today", overview.users_today],
            ["Posts", overview.posts],
            ["Comments", overview.comments],
            ["Messages", overview.messages],
            ["Suspended accounts", analytics?.suspended_users ?? 0],
            ["Open content reports", overview.open_content_reports],
            ["Open account reports", overview.open_account_reports],
          ].map(([label, value]) => (
            <article className="card admin-stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      )}

      <h2>Open content reports</h2>
      {reports.length === 0 ? (
        <p>No open content reports.</p>
      ) : (
        <div className="admin-report-list">
          {reports.map((report) => (
            <article className="card admin-report-card" key={report.id}>
              <div>
                <strong>
                  {report.target_type} #{report.target_id} · {report.reason}
                </strong>
                <p>
                  <a
                    href={`${API_URL.replace(/\/api\/?$/i, "")}/admin/${
                      report.target_type === "post" ? "posts/post" : "comments/comment"
                    }/${report.target_id}/change/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Review reported item
                  </a>
                </p>
                <p>Reported by @{report.reporter_username}</p>
                <p>Content author: {report.target_author_username || "Deleted account"}</p>
                <blockquote>{report.target_text || "Content unavailable"}</blockquote>
                {report.details && <p>Reporter details: {report.details}</p>}
              </div>
              <label>
                Resolution note
                <textarea
                  value={resolutionNotes[report.id] || ""}
                  maxLength={2000}
                  onChange={(event) =>
                    setResolutionNotes((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="admin-report-actions">
                {reviewStatuses.map(([status, label]) => (
                  <button
                    className="btn btn-secondary"
                    key={status}
                    type="button"
                    disabled={savingAction === `content-report-${report.id}`}
                    onClick={() => reviewReport(report.id, status)}
                  >
                    {savingAction === `content-report-${report.id}` ? "Saving..." : label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <h2>Open account reports</h2>
      {accountReports.length === 0 ? (
        <p>No open account reports.</p>
      ) : (
        <div className="admin-report-list">
          {accountReports.map((report) => (
            <article className="card admin-report-card" key={report.id}>
              <div>
                <strong>@{report.reported_username} · {report.reason}</strong>
                <p>Reported by @{report.reporter_username}</p>
                {report.details && <p>{report.details}</p>}
              </div>
              <label>
                Moderator notes
                <textarea
                  value={accountNotes[report.id] || ""}
                  maxLength={2000}
                  onChange={(event) =>
                    setAccountNotes((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={savingAction === `account-report-${report.id}`}
                onClick={() => reviewAccountReport(report.id)}
              >
                {savingAction === `account-report-${report.id}` ? "Saving..." : "Mark reviewed"}
              </button>
            </article>
          ))}
        </div>
      )}

      <h2>User management</h2>
      <form className="admin-user-search" onSubmit={searchUsers}>
        <label>
          Search users
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Username, name, or email"
          />
        </label>
        <label>
          Account status
          <select
            value={userStatus}
            onChange={(event) => setUserStatus(event.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label>
          Staff accounts
          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="true">Staff only</option>
            <option value="false">Non-staff only</option>
          </select>
        </label>
        <label>
          Suspension filter
          <select
            value={suspendedFilter}
            onChange={(event) => setSuspendedFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="true">Suspended only</option>
            <option value="false">Not suspended</option>
          </select>
        </label>
        <button className="btn btn-secondary" type="submit">Search</button>
      </form>
      <label>
        Suspension reason
        <input
          value={suspensionReason}
          maxLength={500}
          onChange={(event) => setSuspensionReason(event.target.value)}
          placeholder="Required before suspending an account"
        />
      </label>
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="admin-report-list">
          {users.map((user) => (
            <article className="card admin-report-card" key={user.id}>
              <div>
                <strong>@{user.username}</strong>
                <p>{user.email}</p>
                <p>
                  {user.is_suspended
                    ? `Suspended: ${user.suspension_reason}`
                    : user.is_active
                      ? "Active"
                      : "Inactive"}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={
                  savingAction === `user-${user.id}` ||
                  user.is_superuser ||
                  user.id === auth?.user?.id ||
                  (!user.is_suspended && !suspensionReason.trim())
                }
                onClick={() => changeUserStatus(user)}
              >
                {savingAction === `user-${user.id}`
                  ? "Saving..."
                  : user.is_suspended
                    ? "Unsuspend"
                    : "Suspend"}
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={
                  savingAction === `user-${user.id}` ||
                  user.is_superuser ||
                  user.id === auth?.user?.id
                }
                onClick={() => deleteUser(user)}
              >
                Delete account
              </button>
            </article>
          ))}
        </div>
      )}

      {analytics?.daily_signups?.length > 0 && (
        <section aria-label="User growth analytics">
          <h2>Daily signups (last {analytics.days} days)</h2>
          <ul>
            {analytics.daily_signups.map(({ date, count }) => (
              <li key={date}>{date}: {count}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
