/** 디스크 사용률 샘플 (원격 disk-history/YYYY-MM-DD.json / UI 일 버킷) */
export interface DiskUsageSample {
  /** ms epoch (해당 날짜 00:00) */
  ts: number;
  usePercent: number;
  usedBytes: number;
  mountedOn: string;
}

export const MAX_DAILY_SAMPLES = 30;

/** 타임스탬프를 로컬 자정(1일) 버킷으로 내림 */
export function dayBucket(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 원격 일별 샘플을 날짜당 1개(최신값)로 합칩니다. */
export function collapseToDaily(samples: DiskUsageSample[]): DiskUsageSample[] {
  const byDay = new Map<number, DiskUsageSample>();

  for (const sample of [...samples].sort((a, b) => a.ts - b.ts)) {
    const bucket = dayBucket(sample.ts);
    byDay.set(bucket, {
      ...sample,
      ts: bucket,
    });
  }

  return [...byDay.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_DAILY_SAMPLES);
}
