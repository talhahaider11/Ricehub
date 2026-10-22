export default function ErrorState({
  message = "Something went wrong.",
  onRetry,
}) {
  return (
    <div className="error-state">
      <h3>Something went wrong</h3>

      <p>{message}</p>

      {onRetry && (
        <button onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}