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
  loading: boolean;
  error: string | null;
}

/** 하루치를 그릴 때 차트에 표시할 최대 점 수 */
export const MAX_DISPLAY_POINTS = 288;

/** 표시 구간 후보 (수집 간격 10초부터) */
const BUCKET_STEPS_MS = [10_000, 60_000, 5 * 60_000];
const MAX_BUCKET_MS = 10 * 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** 샘플 범위가 `MAX_DISPLAY_POINTS` 이하로 들어가는 가장 작은 구간을 고릅니다. */
export function pickBucketMs(samples: ResourceSample[]): number {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const span = first && last ? last.ts - first.ts : 0;
  return (
    BUCKET_STEPS_MS.find((step) => span / step <= MAX_DISPLAY_POINTS) ??
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
 * 원격 `~/.ec2-gui/resource-history`에 쌓인 선택 날짜의 샘플을 차트용 점으로 묶어 반환합니다.
 * `live`(오늘)이면 수집 간격마다 새 샘플을 이어 받습니다.
 */
export function useResourceHistory(
  date: string | null,
  live: boolean,
): ResourceHistoryView {
  const collector = useResourceHistoryCollectorQuery();
  const history = useResourceHistoryQuery(date, { live });
  const raw = history.data;

  const samples = useMemo(() => {
    if (!raw || raw.length === 0) {
      return [];
    }
    return bucketSamples(raw, pickBucketMs(raw));
  }, [raw]);

  return {
    samples,
    loading: history.isLoading,
    error: toMessage(collector.error) ?? toMessage(history.error),
  };
}
