import type { GitHubRepo } from "@/types/github";
import "../css/github.css";

export function RepoBadges({ repo }: { repo: GitHubRepo }) {
  if (!repo.private && !repo.fork && !repo.archived) {
    return null;
  }
  return (
    <span className="github-repo__badges">
      {repo.private ? (
        <span className="github-repo__badge github-repo__badge--private">
          Private
        </span>
      ) : null}
      {repo.fork ? <span className="github-repo__badge">Fork</span> : null}
      {repo.archived ? (
        <span className="github-repo__badge github-repo__badge--archived">
          Archived
        </span>
      ) : null}
    </span>
  );
}
