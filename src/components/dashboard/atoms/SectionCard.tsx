import type { ReactNode } from "react";
import "../css/dashboard.css";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  fill?: boolean;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  badge,
  children,
  fill = true,
  className,
}: SectionCardProps) {
  const rootClass = [
    "dashboard-section",
    fill ? "dashboard-section--fill" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={rootClass}>
      <header className="dashboard-section__header">
        <div className="dashboard-section__heading">
          <h2 className="dashboard-section__title">
            {title}
            {subtitle ? (
              <span className="dashboard-section__subtitle">{subtitle}</span>
            ) : null}
          </h2>
        </div>
        {badge != null ? (
          <span className="dashboard-section__badge">{badge}</span>
        ) : null}
      </header>
      <div className="dashboard-section__body">{children}</div>
    </article>
  );
}
