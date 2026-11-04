import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/admin/StatusBadge";
import ErrorState from "../../components/common/ErrorState";
import Loader from "../../components/common/Loader";
import adminService from "../../services/adminService";

const statusChoices = [
  ["open", "Mark open"],
  ["reviewed", "Mark reviewed"],
  ["action_taken", "Action taken"],
  ["dismissed", "Dismiss"],
];

export default function AdminReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("open");
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setError("");
    try {
      const result = await adminService.getReport(id);
      setReport(result);
      setStatus(result.status);
      setResolutionNote(result.resolution_note || "");
    } catch (loadError) {
      console.error("Report details could not be loaded:", loadError);
      setError("Report details could not be loaded.");
    }
  };

  useEffect(() => {
    loadReport();
  }, [id]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminService.updateReport(id, {
        status,
        resolution_note: resolutionNote.trim(),
      });
      await loadReport();
    } catch (saveError) {
      console.error("Report could not be updated:", saveError);
      setError(saveError.response?.data?.detail || "Report could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  if (!report && !error) return <Loader />;

  return (
    <section>
      <p><Link to="/admin/reports">← Back to reports</Link></p>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {report && (
        <>
          <header className="admin-page-heading">
            <div>
              <h1>Report #{report.id}</h1>
              <p className="muted">Submitted by @{report.reporter_username}</p>
            </div>
            <StatusBadge status={report.status} />
          </header>
          <dl className="admin-detail-list">
            <div><dt>Target</dt><dd>{report.target_type} #{report.target_id}</dd></div>
            <div><dt>Author</dt><dd>{report.target_author_username || "Unavailable"}</dd></div>
            <div><dt>Reason</dt><dd>{report.reason.replaceAll("_", " ")}</dd></div>
            <div><dt>Description</dt><dd>{report.details || "No additional description."}</dd></div>
            <div><dt>Reported content</dt><dd>{report.target_text || "Content unavailable."}</dd></div>
            <div><dt>Reported at</dt><dd>{new Date(report.created_at).toLocaleString()}</dd></div>
          </dl>
          <form className="admin-review-form" onSubmit={save}>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Moderator notes
              <textarea value={resolutionNote} maxLength={2000} onChange={(event) => setResolutionNote(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save review"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
