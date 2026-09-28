export type AutoRefreshInterval = "off" | "10s" | "30s" | "1m" | "10m";

export interface AutoRefreshOption {
  value: AutoRefreshInterval;
  label: string;
  /** `null`이면 자동 새로고침 비활성 */
  ms: number | null;
}

export const DEFAULT_AUTO_REFRESH_INTERVAL: AutoRefreshInterval = "off";

export const AUTO_REFRESH_OPTIONS: AutoRefreshOption[] = [
  { value: "off", label: "없음", ms: null },
  { value: "10s", label: "10초", ms: 10_000 },
  { value: "30s", label: "30초", ms: 30_000 },
  { value: "1m", label: "1분", ms: 60_000 },
  { value: "10m", label: "10분", ms: 600_000 },
];

export function isAutoRefreshInterval(
  value: unknown,
): value is AutoRefreshInterval {
  return (
    value === "off" ||
    value === "10s" ||
    value === "30s" ||
    value === "1m" ||
    value === "10m"
  );
}

export function getAutoRefreshMs(
  interval: AutoRefreshInterval,
): number | null {
  return (
    AUTO_REFRESH_OPTIONS.find((option) => option.value === interval)?.ms ??
    null
  );
}
