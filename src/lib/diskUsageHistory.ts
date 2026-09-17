/** 대시보드 스토리지 사용률 로컬 샘플 (새로고침마다 적재) */
export interface DiskUsageSample {
  ts: number;
  usePercent: number;
  usedBytes: number;
  mountedOn: string;
}

const STORAGE_PREFIX = "ec2-gui-disk-history-v1:";
const MAX_SAMPLES = 24;

function storageKey(hostKey: string): string {
  return `${STORAGE_PREFIX}${hostKey}`;
}

export function diskHistoryHostKey(
  host: string | undefined,
  port: number | undefined,
  username: string | undefined,
): string {
  if (!host) {
    return "default";
  }
  return `${username ?? "user"}@${host}:${port ?? 22}`;
}

export function loadDiskUsageHistory(hostKey: string): DiskUsageSample[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(storageKey(hostKey));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is DiskUsageSample =>
        item != null &&
        typeof item === "object" &&
        typeof (item as DiskUsageSample).ts === "number" &&
        typeof (item as DiskUsageSample).usePercent === "number",
    );
  } catch {
    return [];
  }
}

export function pushDiskUsageSample(
  hostKey: string,
  sample: Omit<DiskUsageSample, "ts"> & { ts?: number },
): DiskUsageSample[] {
  const nextSample: DiskUsageSample = {
    ts: sample.ts ?? Date.now(),
    usePercent: sample.usePercent,
    usedBytes: sample.usedBytes,
    mountedOn: sample.mountedOn,
  };

  const prev = loadDiskUsageHistory(hostKey);
  const last = prev[prev.length - 1];
  // 동일 퍼센트·수초 내 중복 새로고침은 스킵하지 않고, 너무 촘촘한(2초 미만) 연속만 합침
  const merged =
    last && nextSample.ts - last.ts < 2000
      ? [...prev.slice(0, -1), nextSample]
      : [...prev, nextSample];

  const trimmed = merged.slice(-MAX_SAMPLES);

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(storageKey(hostKey), JSON.stringify(trimmed));
    } catch {
      // quota 등은 무시
    }
  }

  return trimmed;
}
