import type { DockerOverviewCounts } from "@/components/dashboard/DockerOverviewSection";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type {
  BlockDevice,
  DiskFilesystem,
  LargeDirectory,
  RemoteOs,
} from "@/types/disk";
import type { DockerContainer } from "@/types/docker";
import type { RemoteSshSession } from "@/types/sshSession";
import type { SystemResources } from "@/types/system";

/** OS별 대시보드 레이아웃이 공유하는 데이터·상태 */
export interface DashboardLayoutProps {
  loading: boolean;
  os?: RemoteOs | null;

  filesystems: DiskFilesystem[];
  directories: LargeDirectory[];
  directoriesLoading: boolean;
  directoriesError: string | null;
  diskHistory: DiskUsageSample[];
  diskLoading: boolean;
  diskHistoryLoading: boolean;
  diskError: string | null;
  storageBadge: string | null;

  blockDevices: BlockDevice[];
  blockDevicesLoading: boolean;
  blockDevicesError: string | null;
  onExpandDisk?: () => void;

  systemResources: SystemResources | null;
  /** 마지막 시스템 리소스 조회 시각 (ms epoch, 미조회 시 0) */
  systemUpdatedAt: number;
  systemLoading: boolean;
  systemError: string | null;

  showDocker: boolean;
  dockerCounts: DockerOverviewCounts | null;
  recentContainers: DockerContainer[];
  dockerLoading: boolean;
  dockerError: string | null;
  dockerBadge: string | null;
  dockerInstalledPending: boolean;

  sshSessions: RemoteSshSession[];
  sshLoading: boolean;
  sshError: string | null;
}

