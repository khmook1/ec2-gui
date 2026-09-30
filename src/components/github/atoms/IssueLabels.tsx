import { labelTextColor } from "@/lib/github";
import type { GitHubLabel } from "@/types/github";

export function IssueLabels({ labels }: { labels: GitHubLabel[] }) {
  if (labels.length === 0) {
    return null;
  }
  return (
    <span className="github-labels">
      {labels.map((label) => (
        <span
          key={label.name}
          className="github-label"
          style={{
            background: `#${label.color}`,
            color: labelTextColor(label.color),
          }}
        >
          {label.name}
        </span>
      ))}
    </span>
  );
}
