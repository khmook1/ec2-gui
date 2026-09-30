import type { GitHubIssueState } from "@/types/github";

interface StateBadgeProps {
  state: GitHubIssueState;
  merged?: boolean;
  draft?: boolean;
  size?: "sm" | "lg";
}

export function StateBadge({
  state,
  merged = false,
  draft = false,
  size = "sm",
}: StateBadgeProps) {
  const variant = merged
    ? "merged"
    : state === "closed"
      ? "closed"
      : draft
        ? "draft"
        : "open";
  const label = {
    merged: "Merged",
    closed: "Closed",
    draft: "Draft",
    open: "Open",
  }[variant];

  return (
    <span
      className={[
        "github-state",
        `github-state--${variant}`,
        size === "lg" ? "github-state--lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}
