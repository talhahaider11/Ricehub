const statusLabels = {
  open: "Open",
  pending: "Pending",
  reviewed: "Reviewed",
  action_taken: "Action taken",
  dismissed: "Dismissed",
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export default function StatusBadge({ status }) {
  const normalizedStatus = String(status || "unknown").toLowerCase();
  return (
    <span className={`admin-status-badge admin-status-${normalizedStatus}`}>
      {statusLabels[normalizedStatus] || normalizedStatus.replaceAll("_", " ")}
    </span>
  );
}
