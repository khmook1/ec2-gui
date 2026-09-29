import { ResourceTrendChart } from "@/components/dashboard/atoms/ResourceTrendChart";
import {
  pickPrimaryFilesystem,
  toneForPercent,
} from "@/components/dashboard/utils/diskUi";
import {
  RESOURCE_SERIES,
  formatMbps,
  type ResourceSeriesKey,
} from "@/components/dashboard/utils/resourceUi";
import { useResourceHistory } from "@/components/dashboard/utils/useResourceHistory";
import {
  CpuIcon,
  DiskIcon,
  MemoryIcon,
  NetworkIcon,
} from "@/components/icons/ResourceIcons";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { DiskFilesystem, RemoteOs } from "@/types/disk";
import type { SystemResources } from "@/types/system";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

interface ResourceOverviewSectionProps {
  resources: SystemResources | null;
  updatedAt: number;
  filesystems: DiskFilesystem[];
  os?: RemoteOs | null;
  loading: boolean;
  error: string | null;
}

interface ChipData {
  icon: ReactNode;
  percent: number | null;
  meta: string;
}

export function ResourceOverviewSection({
  resources: liveResources,
  updatedAt,
  filesystems,
  os,
  loading,
  error,
}: ResourceOverviewSectionProps) {
  const [focused, setFocused] = useState<ResourceSeriesKey | null>(null);
  const primary = pickPrimaryFilesystem(filesystems, os);
  const { samples, resources } = useResourceHistory(
    liveResources,
    updatedAt,
    primary?.usePercent ?? null,
  );

  if (loading && !resources && !primary) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
      </div>
    );
  }

  const chips: Record<ResourceSeriesKey, ChipData> = {
    cpu: {
      icon: <CpuIcon />,
      percent: resources?.cpu.usePercent ?? null,
      meta: resources
        ? `${resources.cpu.cores}코어 · 로드 ${resources.cpu.load1.toFixed(2)}`
        : "—",
    },
    memory: {
      icon: <MemoryIcon />,
      percent: resources?.memory.usePercent ?? null,
      meta: resources
        ? `${formatFileSize(resources.memory.usedBytes)} / ${formatFileSize(resources.memory.totalBytes)}`
        : "—",
    },
    disk: {
      icon: <DiskIcon />,
      percent: primary?.usePercent ?? null,
      meta: primary
        ? `${primary.mountedOn} · ${formatFileSize(primary.usedBytes)} / ${formatFileSize(primary.sizeBytes)}`
        : "—",
    },
  };

  const others = primary
    ? filesystems.filter(
        (fs) =>
          !(
            fs.filesystem === primary.filesystem &&
            fs.mountedOn === primary.mountedOn
          ),
      )
    : [];

  return (
    <div className="dashboard-overview" aria-label="리소스 개요">
      {error ? (
        <p
          className="dashboard-section__status dashboard-section__status--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="dashboard-overview__chips">
        {[...RESOURCE_SERIES].reverse().map((series) => {
          const chip = chips[series.key];
          const tone =
            chip.percent == null ? "neutral" : toneForPercent(chip.percent);
          const isFocused = focused === series.key;
          const isOn = focused == null || isFocused;
          const chipClass = [
            "dashboard-overview__chip",
            "dashboard-overview__chip--toggle",
            isOn ? "is-on" : "is-off",
            isFocused ? "is-focused" : null,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={series.key}>
              <button
                type="button"
                className={chipClass}
                style={{ "--chip-color": series.color } as CSSProperties}
                aria-pressed={isFocused}
                title={isFocused ? "전체 보기" : `${series.label}만 보기`}
                onClick={() =>
                  setFocused((prev) => (prev === series.key ? null : series.key))
                }
              >
                <span className="dashboard-overview__chip-head">
                  <span className="dashboard-overview__chip-label">
                    <span className="dashboard-overview__chip-icon" aria-hidden>
                      {chip.icon}
                    </span>
                    {series.label}
                  </span>
                  <span className="dashboard-overview__chip-state" aria-hidden>
                    {isOn ? "ON" : "OFF"}
                  </span>
                </span>
                <strong
                  className={`dashboard-resource__value dashboard-resource__value--${tone}`}
                >
                  {chip.percent == null ? "—" : `${chip.percent}%`}
                </strong>
                <span className="dashboard-overview__chip-meta">
                  {chip.meta}
                </span>
              </button>
            </li>
          );
        })}
        <li className="dashboard-overview__chip">
          <span className="dashboard-overview__chip-label">
            <span className="dashboard-overview__chip-icon" aria-hidden>
              <NetworkIcon />
            </span>
            네트워크
          </span>
          <strong className="dashboard-resource__value">
            {resources
              ? formatMbps(
                  resources.network.rxBytesPerSec +
                    resources.network.txBytesPerSec,
                )
              : "—"}
          </strong>
          <span className="dashboard-overview__chip-meta">
            {resources
              ? `↓ ${formatMbps(resources.network.rxBytesPerSec)} · ↑ ${formatMbps(resources.network.txBytesPerSec)}`
              : "—"}
          </span>
        </li>
      </ul>

      <ResourceTrendChart samples={samples} focused={focused} />

      {others.length > 0 ? (
        <ul className="dashboard-overview__mounts" aria-label="기타 마운트">
          {others.slice(0, 4).map((fs) => (
            <li key={`${fs.filesystem}-${fs.mountedOn}`}>
              <span className="dashboard-overview__mount-path">
                {fs.mountedOn}
              </span>
              <span
                className={`dashboard-resource__value--${toneForPercent(fs.usePercent)}`}
              >
                {fs.usePercent}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
