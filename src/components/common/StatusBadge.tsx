import type { AppRuntimeStatus } from "@/types/app";

interface StatusBadgeProps {
  status: AppRuntimeStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = [
    "status-badge",
    status === "loading" || status === "idle" ? "status-badge--loading" : "",
    status === "error" ? "status-badge--error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-hidden>
      <span className="status-badge__dot" />
    </span>
  );
}
