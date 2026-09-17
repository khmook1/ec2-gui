import type { ReactNode } from "react";
import "../css/info-panel.css";

export type InfoPanelTone =
  "neutral" | "accent" | "success" | "warning" | "danger";

interface InfoPanelProps {
  title: string;
  value: ReactNode;
  description: ReactNode;
  tone?: InfoPanelTone;
  loading?: boolean;
}

export function InfoPanel({
  title,
  value,
  description,
  tone = "neutral",
  loading = false,
}: InfoPanelProps) {
  return (
    <article
      className={`info-panel info-panel--${tone}${loading ? " info-panel--loading" : ""}`}
    >
      <h2 className="info-panel__title">{title}</h2>
      <div className="info-panel__value">{loading ? "…" : value}</div>
      <p className="info-panel__desc">
        {loading ? "불러오는 중" : description}
      </p>
    </article>
  );
}
