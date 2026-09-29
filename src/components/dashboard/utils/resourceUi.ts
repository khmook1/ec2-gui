export type ResourceSeriesKey = "cpu" | "memory" | "disk";

export interface ResourceSeries {
  key: ResourceSeriesKey;
  label: string;
  color: string;
}

/** 추이 차트·요약 칩이 공유하는 시리즈 정의 (뒤쪽 항목이 위에 그려짐) */
export const RESOURCE_SERIES: ResourceSeries[] = [
  { key: "disk", label: "디스크", color: "var(--accent)" },
  { key: "memory", label: "메모리", color: "var(--text-secondary)" },
  { key: "cpu", label: "CPU", color: "var(--text)" },
];

export function formatMbps(bytesPerSec: number): string {
  const mbps = (bytesPerSec * 8) / 1_000_000;
  if (mbps < 0.1) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  if (mbps < 10) {
    return `${mbps.toFixed(1)} Mbps`;
  }
  return `${Math.round(mbps)} Mbps`;
}

export function formatClock(ts: number, withSeconds = true): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  });
}
