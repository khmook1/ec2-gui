import {
  ForkIcon,
  StarIcon,
  WatchIcon,
} from "@/components/icons/GitHubIcons";
import { LanguageBar } from "@/components/github/atoms/LanguageBar";
import { useGitHubLanguagesQuery } from "@/hooks/query";
import { formatGitHubTime } from "@/lib/github";
import { openExternalUrl } from "@/services/tauri";
import type { GitHubRepoDetail } from "@/types/github";

/** Code 탭 오른쪽 About 사이드바 */
export function RepoAbout({ detail }: { detail: GitHubRepoDetail }) {
  const languagesQuery = useGitHubLanguagesQuery(detail.fullName);
  const homepage = detail.homepage?.trim() ?? "";
  const homepageUrl = /^https?:\/\//.test(homepage)
    ? homepage
    : homepage
      ? `https://${homepage}`
      : "";

  return (
    <aside className="github-about">
      <section className="github-about__section">
        <h3 className="github-about__title">About</h3>
        <p className="github-about__desc">
          {detail.description || "설명이 없습니다."}
        </p>
        {homepageUrl ? (
          <button
            type="button"
            className="github-link github-about__homepage"
            onClick={() => void openExternalUrl(homepageUrl)}
          >
            {homepage}
          </button>
        ) : null}
        {detail.topics.length > 0 ? (
          <div className="github-topics">
            {detail.topics.map((topic) => (
              <span key={topic} className="github-topic">
                {topic}
              </span>
            ))}
          </div>
        ) : null}
        <ul className="github-about__stats">
          <li>
            <StarIcon />
            <strong>{detail.stargazers.toLocaleString("ko-KR")}</strong> stars
          </li>
          <li>
            <WatchIcon />
            <strong>{detail.watchers.toLocaleString("ko-KR")}</strong> watching
          </li>
          <li>
            <ForkIcon />
            <strong>{detail.forks.toLocaleString("ko-KR")}</strong> forks
          </li>
        </ul>
        <dl className="github-about__meta">
          {detail.license ? (
            <>
              <dt>License</dt>
              <dd>{detail.license}</dd>
            </>
          ) : null}
          <dt>생성</dt>
          <dd>{formatGitHubTime(detail.createdAt)}</dd>
          <dt>최근 push</dt>
          <dd>{formatGitHubTime(detail.pushedAt)}</dd>
        </dl>
      </section>

      {languagesQuery.data && languagesQuery.data.length > 0 ? (
        <section className="github-about__section">
          <h3 className="github-about__title">Languages</h3>
          <LanguageBar languages={languagesQuery.data} />
        </section>
      ) : null}
    </aside>
  );
}
