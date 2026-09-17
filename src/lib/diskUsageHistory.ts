/** 디스크 사용률 샘플 (원격 storage.json / UI 시간 버킷) */
export interface DiskUsageSample {
  /** ms epoch (10분 또는 1시간 버킷) */
  ts: number;
  usePercent: number;
  usedBytes: number;
  mountedOn: string;
}

const MAX_HOURLY_SAMPLES = 24;
const HOUR_MS = 60 * 60 * 1000;

/** 타임스탬프를 정시(1시간) 버킷으로 내림 */
export function hourBucket(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

/** 10분 단위 원격 샘플을 시간당 1개(최신값)로 합칩니다. */
export function collapseToHourly(samples: DiskUsageSample[]): DiskUsageSample[] {
  const byHour = new Map<number, DiskUsageSample>();

  for (const sample of samples) {
    const bucket = hourBucket(sample.ts);
    byHour.set(bucket, {
      ...sample,
      ts: bucket,
    });
  }

  return [...byHour.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_HOURLY_SAMPLES);
}
