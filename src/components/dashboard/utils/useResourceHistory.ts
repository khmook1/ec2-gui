import { useMemo } from "react";
import {
  useResourceHistoryCollectorQuery,
  useResourceHistoryQuery,
} from "@/hooks/query/dashboard";
import type { ResourceHistorySample } from "@/types/system";

/** 리소스 추이 차트 샘플 (사용률 %) */
export type ResourceSample = ResourceHistorySample;

export interface ResourceHistoryView {
  samples: ResourceSample[];
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

/** 수집 샘플을 `bucketMs` 구간별 평균 점으로 묶습니다. */
export function bucketSamples(
  samples: ResourceSample[],
  bucketMs: number,
): ResourceSample[] {
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

/** 원격 서버 기준 `YYYY-MM-DD` 하루의 [시작, 끝) 타임스탬프(ms) */
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
 * 원격 `~/.ec2-gui/resource-history`에 쌓인 선택 날짜의 샘플 중
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
  const collector = useResourceHistoryCollectorQuery();
  const history = useResourceHistoryQuery(date, { live });
  const raw = history.data;
  const dayStart = day?.[0] ?? null;

  const view = useMemo(() => {
    const first = raw?.[0];
    const last = raw?.[raw.length - 1];
    if (!raw || !first || !last) {
      return { samples: [], domain: null, spanMs: null };
    }
    const end = last.ts;
    const start =
      dayStart == null ? end - windowMs : Math.max(dayStart, end - windowMs);
    const inWindow = raw.filter((s) => s.ts >= start && s.ts <= end);
    const dataStart =
      dayStart == null ? first.ts : Math.max(dayStart, first.ts);
    return {
      samples: bucketSamples(inWindow, pickBucketMs(end - start)),
      domain: [start, end] as [number, number],
      spanMs: end - dataStart,
    };
  }, [raw, windowMs, dayStart]);

  return {
    samples: view.samples,
    domain: view.domain,
    spanMs: view.spanMs,
    loading: history.isLoading,
    error: toMessage(collector.error) ?? toMessage(history.error),
  };
}
