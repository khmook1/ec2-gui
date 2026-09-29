import type { ReactNode } from "react";
import "../css/info-panel.css";

interface InfoPanelProps {
  title: string;
  value: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}

export function InfoPanel({
  title,
  value,
  description,
  icon,
  loading = false,
}: InfoPanelProps) {
  return (
    <article className={`info-panel${loading ? " info-panel--loading" : ""}`}>
      <h2 className="info-panel__title">
        {icon ? <span className="info-panel__icon">{icon}</span> : null}
        {title}
      </h2>
      <div className="info-panel__value">{loading ? "…" : value}</div>
      <p className="info-panel__desc">
        {loading ? "불러오는 중" : description}
      </p>
    </article>
  );
}
