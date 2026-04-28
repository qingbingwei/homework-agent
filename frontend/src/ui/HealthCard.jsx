export function HealthCard({ health }) {
  return (
    <aside className="status-card">
      <p className="status-label">系统状态</p>
      <strong>{health.message}</strong>
      <span>{health.meta}</span>
    </aside>
  );
}

