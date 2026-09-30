import { languageColor } from "@/lib/github";
import type { GitHubLanguage } from "@/types/github";

/** GitHub About 영역의 언어 비율 막대 */
export function LanguageBar({ languages }: { languages: GitHubLanguage[] }) {
  const total = languages.reduce((sum, language) => sum + language.bytes, 0);
  if (total === 0) {
    return null;
  }
  const items = languages.map((language) => ({
    ...language,
    percent: (language.bytes / total) * 100,
  }));

  return (
    <div className="github-languages">
      <div className="github-languages__bar" aria-hidden>
        {items.map((item) => (
          <span
            key={item.name}
            style={{
              width: `${item.percent}%`,
              background: languageColor(item.name),
            }}
          />
        ))}
      </div>
      <ul className="github-languages__list">
        {items.map((item) => (
          <li key={item.name}>
            <span
              className="github-languages__dot"
              style={{ background: languageColor(item.name) }}
            />
            <span className="github-languages__name">{item.name}</span>
            <span className="github-languages__percent">
              {item.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
