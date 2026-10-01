import { describeRunState } from "@/lib/github";

interface RunStatusBadgeProps {
  status: string;
  conclusion: string | null;
  /** false면 아이콘만 보여 주고 라벨은 title로 */
  showLabel?: boolean;
}

export function RunStatusBadge({
  status,
  conclusion,
  showLabel = false,
}: RunStatusBadgeProps) {
  const { label, tone } = describeRunState(status, conclusion);
  return (
    <span
      className={`github-run-status github-run-status--${tone}`}
      title={label}
      aria-label={showLabel ? undefined : label}
    >
      <span className="github-run-status__icon" aria-hidden />
      {showLabel ? <span className="github-run-status__label">{label}</span> : null}
    </span>
  );
}
