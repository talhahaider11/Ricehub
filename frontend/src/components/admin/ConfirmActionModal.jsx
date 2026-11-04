export default function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  destructive = false,
  children,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop">
      <section
        className="admin-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
      >
        <h2 id="admin-confirm-title">{title}</h2>
        <p>{message}</p>
        {children}
        <div className="admin-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
