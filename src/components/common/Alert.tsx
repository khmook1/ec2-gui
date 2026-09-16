import type { HTMLAttributes, ReactNode } from "react";

export type AlertVariant = "info" | "success" | "error" | "warning";

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
}

export function Alert({
  variant = "info",
  title,
  className,
  children,
  role = "note",
  ...rest
}: AlertProps) {
  const classes = ["alert", `alert--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role={role} {...rest}>
      {title ? <span className="alert__title">{title}</span> : null}
      {children ? <div className="alert__body">{children}</div> : null}
    </div>
  );
}
