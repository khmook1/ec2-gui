import type { LargeDirectory } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

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

  if (loading) {
    return (
      <div className="dashboard-skeleton" aria-busy="true" aria-label="불러오는 중">
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (directories.length === 0) {
    return (
      <p className="dashboard-section__status" role="status">
        표시할 디렉터리가 없습니다.
      </p>
    );
  }

  return (
    <ul className="dashboard-dir-list">
      {directories.map((dir, index) => {
        const ratio =
          maxSize > 0
            ? Math.max(4, Math.round((dir.sizeBytes / maxSize) * 100))
            : 0;
        return (
          <li key={dir.path} className="dashboard-dir-item">
            <div className="dashboard-dir-item__row">
              <span className="dashboard-dir-item__rank">{index + 1}</span>
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
  );
}
