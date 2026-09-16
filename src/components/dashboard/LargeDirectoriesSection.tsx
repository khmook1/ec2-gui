import type { LargeDirectory } from "@/types/disk";
import { formatFileSize } from "@/utils/file";

interface LargeDirectoriesSectionProps {
  directories: LargeDirectory[];
  loading: boolean;
  error: string | null;
}

export function LargeDirectoriesSection({
  directories,
  loading,
  error,
}: LargeDirectoriesSectionProps) {
  const maxSize = directories[0]?.sizeBytes ?? 0;

  return (
    <article className="dashboard-section">
      <header className="dashboard-section__header">
        <div>
          <h2 className="dashboard-section__title">용량이 큰 디렉터리</h2>
          <p className="dashboard-section__subtitle">
            루트(`/`) 1depth 사용량 상위
          </p>
        </div>
        {!loading && !error && directories.length > 0 ? (
          <span className="dashboard-section__badge">{directories.length}</span>
        ) : null}
      </header>

      <div className="dashboard-section__body">
        {loading ? (
          <p className="dashboard-section__status" role="status">
            디렉터리 사용량을 측정하는 중…
          </p>
        ) : null}

        {!loading && error ? (
          <p
            className="dashboard-section__status dashboard-section__status--error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!loading && !error && directories.length === 0 ? (
          <p className="dashboard-section__status" role="status">
            표시할 디렉터리가 없습니다.
          </p>
        ) : null}

        {!loading && !error && directories.length > 0 ? (
          <ul className="dashboard-dir-list">
            {directories.map((dir, index) => {
              const ratio =
                maxSize > 0
                  ? Math.max(4, Math.round((dir.sizeBytes / maxSize) * 100))
                  : 0;
              return (
                <li key={dir.path} className="dashboard-dir-item">
                  <div className="dashboard-dir-item__row">
                    <span className="dashboard-dir-item__rank">
                      {index + 1}
                    </span>
                    <code className="dashboard-dir-item__path">{dir.path}</code>
                    <span className="dashboard-dir-item__size">
                      {formatFileSize(dir.sizeBytes)}
                    </span>
                  </div>
                  <div className="dashboard-dir-item__bar" aria-hidden>
                    <span
                      className="dashboard-dir-item__bar-fill"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
