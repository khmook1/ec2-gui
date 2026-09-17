import { toneForPercent } from "@/components/dashboard/utils/diskUi";
import type { SystemResources } from "@/types/system";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

interface SystemResourcesSectionProps {
  resources: SystemResources | null;
  loading: boolean;
  error: string | null;
}

function formatMbps(bytesPerSec: number): string {
  const mbps = (bytesPerSec * 8) / 1_000_000;
  if (mbps < 0.1) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  if (mbps < 10) {
    return `${mbps.toFixed(1)} Mbps`;
  }
  return `${Math.round(mbps)} Mbps`;
}

/** 1 Gbps 기준 대략적 막대 비율 */
function networkBarPercent(rx: number, tx: number): number {
  const mbps = ((rx + tx) * 8) / 1_000_000;
  return Math.min(100, Math.round((mbps / 1000) * 100));
}

export function SystemResourcesSection({
  resources,
  loading,
  error,
}: SystemResourcesSectionProps) {
  if (loading && !resources) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
      </div>
    );
  }

  if (error && !resources) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (!resources) {
    return (
      <p className="dashboard-section__status" role="status">
        시스템 리소스 정보가 없습니다.
      </p>
    );
  }

  const { cpu, memory, network } = resources;
  const cpuTone = toneForPercent(cpu.usePercent);
  const memTone = toneForPercent(memory.usePercent);
  const netPercent = networkBarPercent(
    network.rxBytesPerSec,
    network.txBytesPerSec,
  );
  const totalMbps =
    ((network.rxBytesPerSec + network.txBytesPerSec) * 8) / 1_000_000;

  return (
    <div className="dashboard-resources" aria-label="시스템 리소스">
      {error ? (
        <p
          className="dashboard-section__status dashboard-section__status--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="dashboard-resource">
        <div className="dashboard-resource__row">
          <div className="dashboard-resource__name">
            <span className="dashboard-resource__icon" aria-hidden>
              CPU
            </span>
            <div>
              <strong>CPU</strong>
              <div className="dashboard-resource__meta">
                {cpu.cores}코어 · 로드 {cpu.load1.toFixed(2)}
              </div>
            </div>
          </div>
          <strong
            className={`dashboard-resource__value dashboard-resource__value--${cpuTone}`}
          >
            {cpu.usePercent}%
          </strong>
        </div>
        <div
          className="dashboard-resource__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cpu.usePercent}
          aria-label="CPU 사용률"
        >
          <span
            className={`dashboard-resource__bar-fill dashboard-resource__bar-fill--${cpuTone}`}
            style={{ width: `${cpu.usePercent}%` }}
          />
        </div>
        <div className="dashboard-resource__footer">
          <span>1분 평균 로드</span>
          <span>{cpu.load1.toFixed(2)}</span>
        </div>
      </div>

      <div className="dashboard-resource">
        <div className="dashboard-resource__row">
          <div className="dashboard-resource__name">
            <span className="dashboard-resource__icon" aria-hidden>
              RAM
            </span>
            <div>
              <strong>메모리</strong>
              <div className="dashboard-resource__meta">
                {formatFileSize(memory.usedBytes)} /{" "}
                {formatFileSize(memory.totalBytes)}
              </div>
            </div>
          </div>
          <strong
            className={`dashboard-resource__value dashboard-resource__value--${memTone}`}
          >
            {memory.usePercent}%
          </strong>
        </div>
        <div
          className="dashboard-resource__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={memory.usePercent}
          aria-label="메모리 사용률"
        >
          <span
            className={`dashboard-resource__bar-fill dashboard-resource__bar-fill--${memTone}`}
            style={{ width: `${memory.usePercent}%` }}
          />
        </div>
        <div className="dashboard-resource__footer">
          <span>사용 {formatFileSize(memory.usedBytes)}</span>
          <span>여유 {formatFileSize(memory.availableBytes)}</span>
        </div>
      </div>

      <div className="dashboard-resource">
        <div className="dashboard-resource__row">
          <div className="dashboard-resource__name">
            <span className="dashboard-resource__icon" aria-hidden>
              NET
            </span>
            <div>
              <strong>네트워크</strong>
              <div className="dashboard-resource__meta">
                {network.interface} · 순간 처리량
              </div>
            </div>
          </div>
          <strong className="dashboard-resource__value">
            {totalMbps < 0.1
              ? formatMbps(network.rxBytesPerSec + network.txBytesPerSec)
              : `${totalMbps < 10 ? totalMbps.toFixed(1) : Math.round(totalMbps)} Mbps`}
          </strong>
        </div>
        <div
          className="dashboard-resource__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={netPercent}
          aria-label="네트워크 상대 사용량"
        >
          <span
            className="dashboard-resource__bar-fill dashboard-resource__bar-fill--accent"
            style={{
              width: `${Math.max(netPercent, netPercent > 0 ? 2 : 0)}%`,
            }}
          />
        </div>
        <div className="dashboard-resource__footer">
          <span>↓ {formatMbps(network.rxBytesPerSec)}</span>
          <span>↑ {formatMbps(network.txBytesPerSec)}</span>
        </div>
      </div>
    </div>
  );
}
