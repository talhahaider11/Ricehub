import { useState } from "react";
import Modal from "./Modal";
import moderationService from "../../services/moderationService";

const reasons = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["hate_speech", "Hate speech"],
  ["violence", "Violence"],
  ["nudity", "Nudity"],
  ["other", "Other"],
];

export default function ReportContentButton({ targetType, targetId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await moderationService.reportContent({
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
      });
      setMessage(result.detail);
      setOpen(false);
      setDetails("");
    } catch (submitError) {
      const detail = submitError.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "This content could not be reported."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="post-action"
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Report
      </button>
      {message && <span className="settings-status" role="status">{message}</span>}
      {open && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`Report ${targetType}`}
        >
          <form onSubmit={submit}>
            <label>
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {reasons.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Details (optional)
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={2000}
                rows={4}
              />
            </label>
            {error && <p className="settings-error" role="alert">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit report"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
