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
import {
  dayRange,
  useResourceHistory,
} from "@/components/dashboard/utils/useResourceHistory";
import {
  CpuIcon,
  DiskIcon,
  MemoryIcon,
  NetworkIcon,
} from "@/components/icons/ResourceIcons";
import { useResourceHistoryDaysQuery } from "@/hooks/query/dashboard";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { DiskFilesystem, RemoteOs } from "@/types/disk";
import type { SystemResources } from "@/types/system";
import { formatFileSize } from "@/utils/file";
import "./css/dashboard.css";

interface ResourceOverviewSectionProps {
  resources: SystemResources | null;
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

/** `YYYY-MM-DD` → 선택 목록 라벨 */
function dayLabel(date: string, today: string | undefined): string {
  const short = date.slice(5);
  return date === today ? `오늘 (${short})` : short;
}

export function ResourceOverviewSection({
  resources,
  filesystems,
  os,
  loading,
  error,
}: ResourceOverviewSectionProps) {
  const [focused, setFocused] = useState<ResourceSeriesKey | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const primary = pickPrimaryFilesystem(filesystems, os);

  const { data: daysInfo } = useResourceHistoryDaysQuery();
  const today = daysInfo?.today;
  const dayOptions = [
    ...new Set([...(daysInfo?.days ?? []), ...(today ? [today] : [])]),
  ].sort((a, b) => b.localeCompare(a));
  const selectedDate =
    pickedDate && dayOptions.includes(pickedDate) ? pickedDate : (today ?? null);
  const isToday = selectedDate != null && selectedDate === today;

  const history = useResourceHistory(selectedDate, isToday);
  const chartDomain =
    selectedDate && daysInfo && !isToday
      ? dayRange(selectedDate, daysInfo.utcOffsetMinutes)
      : null;

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

      <div className="dashboard-overview__trend">
        <div className="dashboard-overview__trend-head">
          <span className="dashboard-overview__trend-title">사용률 추이</span>
          <select
            className="dashboard-overview__day-select"
            aria-label="날짜 선택"
            value={selectedDate ?? ""}
            disabled={dayOptions.length === 0}
            onChange={(event) => setPickedDate(event.target.value)}
          >
            {dayOptions.map((date) => (
              <option key={date} value={date}>
                {dayLabel(date, today)}
              </option>
            ))}
          </select>
        </div>
        {history.error ? (
          <p
            className="dashboard-section__status dashboard-section__status--error"
            role="alert"
          >
            {history.error}
          </p>
        ) : null}
        <ResourceTrendChart
          samples={history.samples}
          focused={focused}
          domain={chartDomain}
          emptyLabel={
            history.loading
              ? "불러오는 중…"
              : isToday
                ? "샘플 수집 중…"
                : "저장된 샘플이 없습니다"
          }
        />
      </div>

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
