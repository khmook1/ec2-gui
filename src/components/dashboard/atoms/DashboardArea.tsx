import type { ReactNode } from "react";
import "../css/dashboard.css";

interface DashboardAreaProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 대시보드에서 관련 카드를 묶는 영역(호스트 / Docker 등) */
export function DashboardArea({
  title,
  subtitle,
  icon,
  children,
  className,
}: DashboardAreaProps) {
  const rootClass = ["dashboard-area", className].filter(Boolean).join(" ");

  return (
    <section className={rootClass} aria-label={title}>
      <header className="dashboard-area__header">
        {icon ? (
          <span className="dashboard-area__icon-wrap">{icon}</span>
        ) : null}
        <div className="dashboard-area__heading">
          <h2 className="dashboard-area__title">{title}</h2>
          {subtitle ? (
            <p className="dashboard-area__subtitle">{subtitle}</p>
          ) : null}
        </div>
      </header>
      <div className="dashboard-area__body">{children}</div>
    </section>
  );
}
