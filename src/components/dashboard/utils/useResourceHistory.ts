import { useMemo, useState } from "react";
import { SYSTEM_RESOURCES_POLL_MS } from "@/hooks/query/dashboard";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAutoRefreshStore } from "@/stores/autoRefreshStore";
import type { SystemResources } from "@/types/system";

/** 리소스 추이 차트 샘플 (사용률 %) */
export interface ResourceSample {
  ts: number;
  cpu: number;
  memory: number;
  disk: number | null;
}

/** 화면에 반영된 시점의 스냅샷 */
export interface ResourceHistoryView {
  samples: ResourceSample[];
  resources: SystemResources | null;
}

/** 차트에 표시할 최대 점 수 (점 1개 = 새로고침 주기 1칸) */
export const MAX_DISPLAY_POINTS = 60;

/** 가장 긴 새로고침 주기(10분) × 표시 점 수를 10초 샘플로 담을 수 있는 크기 */
export const MAX_RESOURCE_SAMPLES = 3600;

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
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
    .slice(-MAX_DISPLAY_POINTS)
    .map(([ts, bucket]) => ({
      ts,
      cpu: average(bucket.map((s) => s.cpu)) ?? 0,
      memory: average(bucket.map((s) => s.memory)) ?? 0,
      disk: average(
        bucket.flatMap((s) => (s.disk == null ? [] : [s.disk])),
      ),
    }));
}

interface HistoryState {
  sessionKey: string | null;
  lastUpdatedAt: number;
  samples: ResourceSample[];
  seenTick: number;
  /** 새로고침 신호를 받았고, 다음 샘플이 들어오면 화면에 반영해야 함 */
  pending: boolean;
  view: ResourceHistoryView;
}

function initialState(sessionKey: string | null, tick: number): HistoryState {
  return {
    sessionKey,
    lastUpdatedAt: 0,
    samples: [],
    seenTick: tick,
    pending: false,
    view: { samples: [], resources: null },
  };
}

/**
 * 시스템 리소스 조회 결과가 갱신될 때마다 샘플을 누적하되,
 * 화면용 스냅샷은 새로고침 주기(자동·수동) 이후 첫 샘플에서만 교체합니다.
 * 차트 점은 새로고침 주기 단위 평균이며, 주기가 "없음"이면 수집 간격(10초) 단위입니다.
 * 주기 단위 점이 2개 모이기 전까지는 수집 샘플을 그대로, 수집 즉시 반영합니다.
 */
export function useResourceHistory(
  resources: SystemResources | null,
  updatedAt: number,
  diskPercent: number | null,
): ResourceHistoryView {
  const sessionKey = useSessionKey();
  const uiTick = useAutoRefreshStore((state) => state.uiTick);
  const { intervalMs } = useAutoRefresh();
  const bucketMs = intervalMs ?? SYSTEM_RESOURCES_POLL_MS;
  const [state, setState] = useState<HistoryState>(() =>
    initialState(sessionKey, uiTick),
  );

  let next =
    state.sessionKey === sessionKey ? state : initialState(sessionKey, uiTick);

  if (uiTick !== next.seenTick) {
    next = { ...next, seenTick: uiTick, pending: true };
  }

  if (resources && updatedAt > 0 && updatedAt !== next.lastUpdatedAt) {
    const samples = [
      ...next.samples,
      {
        ts: updatedAt,
        cpu: resources.cpu.usePercent,
        memory: resources.memory.usePercent,
        disk: diskPercent,
      },
    ].slice(-MAX_RESOURCE_SAMPLES);
    next = { ...next, lastUpdatedAt: updatedAt, samples };

    if (next.pending || !spansTwoBuckets(next.view.samples, bucketMs)) {
      next = { ...next, pending: false, view: { samples, resources } };
    }
  }

  if (next !== state) {
    setState(next);
  }

  const { samples: viewSamples, resources: viewResources } = next.view;
  const points = useMemo(() => {
    const bucketed = bucketSamples(viewSamples, bucketMs);
    return bucketed.length >= 2
      ? bucketed
      : viewSamples.slice(-MAX_DISPLAY_POINTS);
  }, [viewSamples, bucketMs]);

  return { samples: points, resources: viewResources };
}

/** 주기 단위 점을 2개 이상 만들 수 있을 만큼 샘플이 모였는지 */
function spansTwoBuckets(samples: ResourceSample[], bucketMs: number): boolean {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) {
    return false;
  }
  return (
    Math.floor(first.ts / bucketMs) !== Math.floor(last.ts / bucketMs)
  );
}
