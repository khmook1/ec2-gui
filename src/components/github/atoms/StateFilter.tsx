import type { GitHubIssueState } from "@/types/github";

interface StateFilterProps {
  value: GitHubIssueState;
  onChange: (state: GitHubIssueState) => void;
  disabled?: boolean;
}

const OPTIONS: { value: GitHubIssueState; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export function StateFilter({ value, onChange, disabled }: StateFilterProps) {
  return (
    <div className="github-segmented" role="tablist" aria-label="상태">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          disabled={disabled}
          className={[
            "github-segmented__item",
            value === option.value ? "github-segmented__item--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
