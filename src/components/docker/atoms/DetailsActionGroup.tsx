import type { ReactNode } from "react";
import "../css/docker-details.css";

interface DetailsActionGroupProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function DetailsActionGroup({
  title,
  description,
  children,
}: DetailsActionGroupProps) {
  return (
    <section className="docker-details__action-group">
      <div className="docker-details__action-heading">
        <h3 className="docker-details__action-title">{title}</h3>
        <p className="docker-details__action-desc">{description}</p>
      </div>
      <div className="docker-details__action-buttons">{children}</div>
    </section>
  );
}
