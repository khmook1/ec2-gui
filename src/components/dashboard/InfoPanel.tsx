import type { ReactNode } from "react";

export type InfoPanelTone = "neutral" | "accent" | "success" | "warning";

interface InfoPanelProps {
  title: string;
  value: ReactNode;
  description: ReactNode;
  tone?: InfoPanelTone;
}

export function InfoPanel({
  title,
  value,
  description,
  tone = "neutral",
}: InfoPanelProps) {
  return (
    <article className={`info-panel info-panel--${tone}`}>
      <h2 className="info-panel__title">{title}</h2>
      <div className="info-panel__value">{value}</div>
      <p className="info-panel__desc">{description}</p>
    </article>
  );
}
