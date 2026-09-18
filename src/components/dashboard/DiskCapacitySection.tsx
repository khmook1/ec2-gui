import {
  pickPrimaryFilesystem,
  toneForPercent,
} from "@/components/dashboard/utils/diskUi";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { DiskFilesystem, RemoteOs } from "@/types/disk";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

interface DiskCapacitySectionProps {
  filesystems: DiskFilesystem[];
  history: DiskUsageSample[];
  loading: boolean;
  error: string | null;
  os?: RemoteOs | null;
}

function formatChartTime(ts: number, prevTs: number | null): string {
  const date = new Date(ts);
  const time = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (prevTs == null) {
    return time;
  }
  const prev = new Date(prevTs);
  if (
    prev.getFullYear() !== date.getFullYear() ||
    prev.getMonth() !== date.getMonth() ||
    prev.getDate() !== date.getDate()
  ) {
    return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
  }
  return time;
}

/** 막대 수에 맞춰 축 라벨을 간격을 두고 표시 (양끝 포함) */
function shouldShowAxisLabel(index: number, total: number): boolean {
  if (total <= 8) {
    return true;
  }
  if (index === 0 || index === total - 1) {
    return true;
  }
  const step = Math.max(2, Math.ceil(total / 6));
  return index % step === 0;
}

export function DiskCapacitySection({
  filesystems,
  history,
  loading,
  error,
  os,
}: DiskCapacitySectionProps) {
  if (loading) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__row dashboard-skeleton__row--short" />
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

  const primary = pickPrimaryFilesystem(filesystems, os);

  if (!primary) {
    return (
      <p className="dashboard-section__status" role="status">
        표시할 디스크 정보가 없습니다.
      </p>
    );
  }

  const tone = toneForPercent(primary.usePercent);
  const others = filesystems.filter(
    (fs) =>
      !(
        fs.filesystem === primary.filesystem &&
        fs.mountedOn === primary.mountedOn
      ),
  );

  const chartSamples =
    history.length > 0
      ? history
      : [
          {
            ts: Date.now(),
            usePercent: primary.usePercent,
            usedBytes: primary.usedBytes,
            mountedOn: primary.mountedOn,
          },
        ];
  const maxPercent = Math.max(
    1,
    ...chartSamples.map((sample) => sample.usePercent),
  );

  return (
    <div className="dashboard-storage">
      <div className="dashboard-storage__top">
        <div>
          <strong className="dashboard-storage__used">
            {formatFileSize(primary.usedBytes)}
          </strong>
          <div className="dashboard-storage__hint">
            {os === "macos" && primary.mountedOn === "/System/Volumes/Data"
              ? "APFS Data 볼륨 사용량"
              : `${primary.mountedOn} 마운트 사용량`}
          </div>
        </div>
        <span
          className={`dashboard-storage__percent dashboard-storage__percent--${tone}`}
        >
          {primary.usePercent}%
        </span>
      </div>

      <div
        className="dashboard-storage__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={primary.usePercent}
        aria-label={`${primary.mountedOn} 사용률`}
      >
        <span
          className={`dashboard-storage__bar-fill dashboard-storage__bar-fill--${tone}`}
          style={{ width: `${Math.min(100, primary.usePercent)}%` }}
        />
      </div>

      <div
        className="dashboard-storage__chart-block"
        role="img"
        aria-label={`디스크 사용률 샘플 ${chartSamples.length}개`}
      >
        <div className="dashboard-storage__chart">
          {chartSamples.map((sample) => {
            const height = Math.max(
              8,
              Math.round((sample.usePercent / maxPercent) * 100),
            );
            return (
              <i
                key={sample.ts}
                title={`${sample.usePercent}% · ${new Date(sample.ts).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="dashboard-storage__chart-axis" aria-hidden="true">
          {chartSamples.map((sample, index) => {
            const prevTs =
              index > 0 ? chartSamples[index - 1]?.ts ?? null : null;
            const show = shouldShowAxisLabel(index, chartSamples.length);
            return (
              <span key={sample.ts} className="dashboard-storage__chart-tick">
                {show ? formatChartTime(sample.ts, prevTs) : null}
              </span>
            );
          })}
        </div>
      </div>
      <div className="dashboard-resource__footer">
        <span>시간별 {history.length}개</span>
        <span>최대 24시간</span>
      </div>

      {others.length > 0 ? (
        <ul className="dashboard-storage__mounts" aria-label="기타 마운트">
          {others.slice(0, 4).map((fs) => {
            const mountTone = toneForPercent(fs.usePercent);
            return (
              <li
                key={`${fs.filesystem}-${fs.mountedOn}`}
                className="dashboard-storage__mount"
              >
                <span className="dashboard-storage__mount-path">
                  {fs.mountedOn}
                </span>
                <span
                  className={`dashboard-storage__mount-pct dashboard-storage__mount-pct--${mountTone}`}
                >
                  {fs.usePercent}%
                </span>
                <span className="dashboard-storage__mount-size">
                  {formatFileSize(fs.usedBytes)} /{" "}
                  {formatFileSize(fs.sizeBytes)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
