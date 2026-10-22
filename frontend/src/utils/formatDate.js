export function formatDate(date) {
  if (!date) return "";

  const value = new Date(date);

  return value.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

export function formatDateTime(date) {
  if (!date) return "";

  return new Date(date).toLocaleString();
}

export function formatRelativeDate(date) {
  if (!date) return "";

  const now = Date.now();
  const target =
    new Date(date).getTime();

  const seconds = Math.floor(
    (now - target) / 1000
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(
    hours / 24
  );

  if (days < 7) {
    return `${days}d`;
  }

  return formatDate(date);
}