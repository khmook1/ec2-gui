import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./css/resource-card.css";

type CardButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "type" | "aria-pressed"
>;

interface ResourceCardProps {
  icon: ReactNode;
  overline: ReactNode;
  name: ReactNode;
  description: ReactNode;
  badges?: ReactNode;
  footer: ReactNode;
  accessory?: ReactNode;
  cornerAction?: ReactNode;
  selected: boolean;
  tone: "github" | "docker" | "nginx" | "paused" | "restarting" | "stopped";
  buttonProps: CardButtonProps;
}

export function ResourceCard({
  icon,
  overline,
  name,
  description,
  badges,
  footer,
  accessory,
  cornerAction,
  selected,
  tone,
  buttonProps,
}: ResourceCardProps) {
  return (
    <div className="resource-card__cell" role="listitem">
      <button
        {...buttonProps}
        type="button"
        className={[
          "resource-card",
          `resource-card--${tone}`,
          selected ? "resource-card--selected" : "",
          cornerAction ? "resource-card--has-corner-action" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={selected}
      >
        <span className="resource-card__header">
          <span className="resource-card__icon-wrap">
            <span className="resource-card__icon">{icon}</span>
          </span>
          <span className="resource-card__identity">
            <span className="resource-card__overline">{overline}</span>
            <span className="resource-card__name">{name}</span>
          </span>
          {accessory ? (
            <span className="resource-card__accessory">{accessory}</span>
          ) : null}
        </span>
        <span className="resource-card__description">{description}</span>
        {badges ? (
          <span className="resource-card__badges">{badges}</span>
        ) : null}
        <span className="resource-card__footer">{footer}</span>
      </button>
      {cornerAction}
    </div>
  );
}
