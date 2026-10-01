import type { GitHubRepo } from "@/types/github";
import "../css/github.css";

const LANGUAGE_BADGE_MODIFIERS: Record<string, string> = {
  TypeScript: "typescript",
  JavaScript: "javascript",
  Kotlin: "kotlin",
  Java: "java",
  Swift: "swift",
};

function LanguageBadge({ language }: { language: string }) {
  const modifier = LANGUAGE_BADGE_MODIFIERS[language];
  return (
    <span
      className={[
        "github-repo__badge",
        "github-repo__badge--lang",
        modifier ? `github-repo__badge--lang-${modifier}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {language}
    </span>
  );
}

export function RepoBadges({ repo }: { repo: GitHubRepo }) {
  if (!repo.private && !repo.language && !repo.fork && !repo.archived) {
    return null;
  }
  return (
    <span className="github-repo__badges">
      {repo.private ? (
        <span className="github-repo__badge github-repo__badge--private">
          <svg
            className="github-repo__badge-icon"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.75 0h4.5V5a2.25 2.25 0 0 0-4.5 0v2Z" />
          </svg>
          Private
        </span>
      ) : null}
      {repo.language ? <LanguageBadge language={repo.language} /> : null}
      {repo.fork ? <span className="github-repo__badge">Fork</span> : null}
      {repo.archived ? (
        <span className="github-repo__badge github-repo__badge--archived">
          Archived
        </span>
      ) : null}
    </span>
  );
}
