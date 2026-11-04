export default function StatCard({ title, value }) {
  return (
    <article className="card admin-stat-card">
      <span>{title}</span>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}
