import { useEffect, useState } from "react";
import ReportTable from "../../components/admin/ReportTable";
import ErrorState from "../../components/common/ErrorState";
import Loader from "../../components/common/Loader";
import adminService from "../../services/adminService";
import { getArrayResults } from "../../utils/arrayResults";

const reportStatuses = ["open", "reviewed", "action_taken", "dismissed"];

export default function AdminReports() {
  const [status, setStatus] = useState("open");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminService.getReports({ status });
      setReports(getArrayResults(response, "Admin reports"));
    } catch (loadError) {
      console.error("Admin reports could not be loaded:", loadError);
      setError("Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [status]);

  return (
    <section>
      <header className="admin-page-heading">
        <div>
          <h1>Reports</h1>
          <p className="muted">Review reports submitted about posts and comments.</p>
        </div>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {reportStatuses.map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
      </header>
      {loading ? <Loader /> : error ? (
        <ErrorState message={error} onRetry={loadReports} />
      ) : (
        <ReportTable reports={reports} />
      )}
    </section>
  );
}
