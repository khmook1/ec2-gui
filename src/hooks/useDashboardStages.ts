import { dashboardFeatureSupport } from "@/components/dashboard/utils/featureSupport";
import {
  useDiskHistoryQuery,
  useDiskOverviewQuery,
  useSystemResourcesQuery,
} from "@/hooks/query";

/**
 * 대시보드 원격 조회를 우선순위 단계로 나눈다. SSH exec는 백엔드에서 직렬 실행되므로,
 * 핵심 데이터가 먼저 오도록 뒤 단계 쿼리는 앞 단계가 끝난 뒤에 활성화한다.
 *
 * - 1단계: 디스크 개요 (원격 OS 감지 포함)
 * - 2단계: 시스템 리소스, 디스크 히스토리(수집기 설치 포함)
 * - 3단계(`stage3Ready`): SSH 세션, Docker 개요, 블록 디바이스
 *
 * React Query는 observer 중 하나라도 enabled면 실행하므로, 같은 쿼리를 쓰는 곳은 이 훅을 함께 사용한다.
 */
export function useDashboardStages() {
  const diskQuery = useDiskOverviewQuery();
  const features = dashboardFeatureSupport(diskQuery.data?.os);
  const stage2Ready = diskQuery.isFetched;

  const systemQuery = useSystemResourcesQuery({
    enabled: stage2Ready && features.systemResources,
  });
  const diskHistoryQuery = useDiskHistoryQuery({ enabled: stage2Ready });

  const stage3Ready =
    stage2Ready &&
    diskHistoryQuery.isFetched &&
    (!features.systemResources || systemQuery.isFetched);

  return {
    diskQuery,
    diskHistoryQuery,
    systemQuery,
    features,
    stage2Ready,
    stage3Ready,
  };
}
