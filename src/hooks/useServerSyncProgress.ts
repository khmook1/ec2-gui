import {
  useDiskHistoryQuery,
  useDiskOverviewQuery,
  useDockerInstalledQuery,
  useDockerOverviewQuery,
  usePermissionOverviewQuery,
  useSshSessionsQuery,
  useSystemResourcesQuery,
} from "@/hooks/query";
import { dashboardFeatureSupport } from "@/components/dashboard/utils/featureSupport";

export interface ServerSyncProgress {
  /** 0~1 */
  progress: number;
  /** 완료된 단계 수 */
  completed: number;
  /** 전체 단계 수 */
  total: number;
  isComplete: boolean;
}

/** 대시보드와 동일 쿼리 키를 공유해, 오버레이에서 미리 로드한 데이터가 재사용됩니다. */
export function useServerSyncProgress(): ServerSyncProgress {
  const diskQuery = useDiskOverviewQuery();
  const diskHistoryQuery = useDiskHistoryQuery();
  const features = dashboardFeatureSupport(diskQuery.data?.os);
  const systemQuery = useSystemResourcesQuery({
    enabled: features.systemResources,
  });
  const sshQuery = useSshSessionsQuery();
  const permissionQuery = usePermissionOverviewQuery();
  const dockerInstalledQuery = useDockerInstalledQuery();
  const showDocker = dockerInstalledQuery.data === true;
  const dockerQuery = useDockerOverviewQuery({ enabled: showDocker });

  const pendingFlags = [
    diskQuery.isPending,
    diskHistoryQuery.isPending,
    sshQuery.isPending,
    permissionQuery.isPending,
    dockerInstalledQuery.isPending,
  ];

  if (features.systemResources) {
    pendingFlags.push(systemQuery.isPending);
  }

  if (showDocker) {
    pendingFlags.push(dockerQuery.isPending);
  }

  const total = pendingFlags.length;
  const completed = pendingFlags.filter((pending) => !pending).length;
  const isComplete = completed === total && total > 0;
  const progress = total === 0 ? 0 : completed / total;

  return { progress, completed, total, isComplete };
}
