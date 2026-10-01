import { useMemo } from "react";
import { useResourceHistoryQuery } from "@/hooks/query/dashboard";
import type { ResourceHistorySample } from "@/types/system";

/** 리소스 추이 차트 샘플 (사용률 %) */
export type ResourceSample = ResourceHistorySample;

/** 차트 점. 집계 안 된 구간은 값이 모두 `null`이고 `gap`에 구간 [시작, 끝]이 담긴다. */
export interface ResourceTrendPoint {
  ts: number;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  gap?: [number, number];
}

export interface ResourceHistoryView {
  samples: ResourceTrendPoint[];
  /** 표시 구간 안에서 샘플이 없는 [시작, 끝] 구간 */
  gaps: [number, number][];
  /** 차트 X축 범위. 샘플이 없으면 `null` */
  domain: [number, number] | null;
  /** 첫 샘플부터 마지막 샘플까지의 길이(ms). 샘플이 없으면 `null` */
  spanMs: number | null;
  loading: boolean;
  error: string | null;
}

/** 하루치를 그릴 때 차트에 표시할 최대 점 수 */
export const MAX_DISPLAY_POINTS = 288;

/** 표시 구간 후보 (수집 간격 10초부터) */
const BUCKET_STEPS_MS = [
  10_000,
  20_000,
  30_000,
  60_000,
  2 * 60_000,
  3 * 60_000,
  5 * 60_000,
];
const MAX_BUCKET_MS = 10 * 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_TREND_WINDOW_MS = 30 * 60_000;

/** 휠로 고를 수 있는 표시 범위 (최소 30분 ~ 최대 하루) */
export const TREND_WINDOW_STEPS_MS = [
  MIN_TREND_WINDOW_MS,
  60 * 60_000,
  2 * 60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  DAY_MS,
];

/** 표시 범위 라벨 (`30분`, `2시간`, `하루`) */
export function formatTrendWindow(windowMs: number): string {
  if (windowMs >= DAY_MS) {
    return "하루";
  }
  const minutes = Math.round(windowMs / 60_000);
  return minutes < 60 ? `${minutes}분` : `${minutes / 60}시간`;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** `spanMs` 범위가 `MAX_DISPLAY_POINTS` 이하로 들어가는 가장 작은 구간을 고릅니다. */
export function pickBucketMs(spanMs: number): number {
  return (
    BUCKET_STEPS_MS.find((step) => spanMs / step <= MAX_DISPLAY_POINTS) ??
    MAX_BUCKET_MS
  );
}

/** 이보다 짧은 수집 공백은 일시적인 누락으로 보고 집계 안 됨으로 표시하지 않는다. */
const MIN_GAP_MS = 60_000;

/** `[start, …]` 구간에서 샘플 간격이 `minGapMs`를 넘는 빈 구간을 찾습니다. */
export function findGaps(
  samples: ResourceSample[],
  start: number,
  minGapMs: number,
): [number, number][] {
  const gaps: [number, number][] = [];
  let prev = start;
  for (const sample of samples) {
    if (sample.ts - prev > minGapMs) {
      gaps.push([prev, sample.ts]);
    }
    prev = sample.ts;
  }
  return gaps;
}

/** 빈 구간 가운데에 `null` 점을 넣어 차트 선이 공백을 건너 이어지지 않게 합니다. */
function withGapPoints(
  points: ResourceTrendPoint[],
  gaps: [number, number][],
): ResourceTrendPoint[] {
  if (gaps.length === 0) {
    return points;
  }
  const breaks = gaps.map<ResourceTrendPoint>((gap) => ({
    ts: Math.round((gap[0] + gap[1]) / 2),
    cpu: null,
    memory: null,
    disk: null,
    gap,
  }));
  return [...points, ...breaks].sort((a, b) => a.ts - b.ts);
}

/** 수집 샘플을 `bucketMs` 구간별 평균 점으로 묶습니다. */
export function bucketSamples(
  samples: ResourceSample[],
  bucketMs: number,
): ResourceTrendPoint[] {
  const buckets = new Map<number, ResourceSample[]>();
  for (const sample of samples) {
    const key = Math.floor(sample.ts / bucketMs) * bucketMs;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(sample);
    } else {
      buckets.set(key, [sample]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, bucket]) => ({
      ts,
      cpu: average(bucket.map((s) => s.cpu)) ?? 0,
      memory: average(bucket.map((s) => s.memory)) ?? 0,
      disk: average(
        bucket.flatMap((s) => (s.disk == null ? [] : [s.disk])),
      ),
    }));
}

/** `utcOffsetMinutes` 기준 `YYYY-MM-DD` 하루의 [시작, 끝) 타임스탬프(ms) */
export function dayRange(
  date: string,
  utcOffsetMinutes: number,
): [number, number] | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) {
    return null;
  }
  const start = Date.UTC(y, m - 1, d) - utcOffsetMinutes * 60_000;
  return [start, start + DAY_MS];
}

function toMessage(error: unknown): string | null {
  if (error == null) {
    return null;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * 앱이 연결된 동안 이 컴퓨터에 쌓은 선택 날짜의 샘플 중
 * 마지막 샘플 기준 `windowMs` 구간만 차트용 점으로 묶어 반환합니다.
 * `day`(해당 날짜의 [시작, 끝))가 주어지면 구간 시작을 그날 00:00 이후로 제한합니다.
 * `live`(오늘)이면 수집 간격마다 새 샘플을 이어 받습니다.
 */
export function useResourceHistory(
  date: string | null,
  live: boolean,
  windowMs: number,
  day: [number, number] | null,
): ResourceHistoryView {
  const history = useResourceHistoryQuery(date, { live });
  const raw = history.data;
  const dayStart = day?.[0] ?? null;

  const view = useMemo(() => {
    const first = raw?.[0];
    const last = raw?.[raw.length - 1];
    if (!raw || !first || !last) {
      return { samples: [], gaps: [], domain: null, spanMs: null };
    }
    const end = last.ts;
    const start =
      dayStart == null ? end - windowMs : Math.max(dayStart, end - windowMs);
    const inWindow = raw.filter((s) => s.ts >= start && s.ts <= end);
    const dataStart =
      dayStart == null ? first.ts : Math.max(dayStart, first.ts);
    const bucketMs = pickBucketMs(end - start);
    const gaps = findGaps(inWindow, start, Math.max(bucketMs * 2, MIN_GAP_MS));
    return {
      samples: withGapPoints(bucketSamples(inWindow, bucketMs), gaps),
      gaps,
      domain: [start, end] as [number, number],
      spanMs: end - dataStart,
    };
  }, [raw, windowMs, dayStart]);

  return {
    samples: view.samples,
    gaps: view.gaps,
    domain: view.domain,
    spanMs: view.spanMs,
    loading: history.isLoading,
    error: toMessage(history.error),
  };
}
