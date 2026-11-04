import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

export default function ReportTable({ reports, emptyMessage = "No reports found." }) {
  if (!reports.length) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Reason</th>
            <th>Target</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{report.id}</td>
              <td>{report.reason.replaceAll("_", " ")}</td>
              <td>{report.target_type} #{report.target_id}</td>
              <td><StatusBadge status={report.status} /></td>
              <td>{report.created_at ? new Date(report.created_at).toLocaleDateString() : "—"}</td>
              <td><Link to={`/admin/reports/${report.id}`}>Review</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
