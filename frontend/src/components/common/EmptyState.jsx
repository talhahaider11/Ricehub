export default function EmptyState({
  title,
  message,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        ○
      </div>

      <h3>{title}</h3>

      <p>{message}</p>

      {action}
    </div>
  );
}