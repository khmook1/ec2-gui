import {
  formatDiskUsageLine,
  toneForPercent,
} from "@/components/dashboard/diskUi";
import type { DiskFilesystem } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

interface DiskCapacitySectionProps {
  filesystems: DiskFilesystem[];
  loading: boolean;
  error: string | null;
}

export function DiskCapacitySection({
  filesystems,
  loading,
  error,
}: DiskCapacitySectionProps) {
  return (
    <article className="dashboard-section">
      <header className="dashboard-section__header">
        <div>
          <h2 className="dashboard-section__title">디스크 용량</h2>
          <p className="dashboard-section__subtitle">
            주요 마운트 포인트 사용량
          </p>
        </div>
        {!loading && !error && filesystems.length > 0 ? (
          <span className="dashboard-section__badge">{filesystems.length}</span>
        ) : null}
      </header>

      <div className="dashboard-section__body">
        {loading ? (
          <p className="dashboard-section__status" role="status">
            용량 정보를 불러오는 중…
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

        {!loading && !error && filesystems.length === 0 ? (
          <p className="dashboard-section__status" role="status">
            표시할 디스크 정보가 없습니다.
          </p>
        ) : null}

        {!loading && !error && filesystems.length > 0 ? (
          <ul className="dashboard-disk-list">
            {filesystems.map((fs) => {
              const tone = toneForPercent(fs.usePercent);
              return (
                <li
                  key={`${fs.filesystem}-${fs.mountedOn}`}
                  className="dashboard-disk-item"
                >
                  <div className="dashboard-disk-item__top">
                    <div className="dashboard-disk-item__meta">
                      <span className="dashboard-disk-item__mount">
                        {fs.mountedOn}
                      </span>
                      <span className="dashboard-disk-item__device">
                        {fs.filesystem}
                      </span>
                    </div>
                    <span
                      className={`dashboard-disk-item__percent dashboard-disk-item__percent--${tone}`}
                    >
                      {fs.usePercent}%
                    </span>
                  </div>
                  <div
                    className="dashboard-disk-item__bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={fs.usePercent}
                    aria-label={`${fs.mountedOn} 사용률`}
                  >
                    <span
                      className={`dashboard-disk-item__bar-fill dashboard-disk-item__bar-fill--${tone}`}
                      style={{ width: `${Math.min(100, fs.usePercent)}%` }}
                    />
                  </div>
                  <p className="dashboard-disk-item__usage">
                    {formatDiskUsageLine(fs)} · 여유{" "}
                    {formatFileSize(fs.availableBytes)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
