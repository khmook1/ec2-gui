import type { RemoteOs } from "@/types/disk";

export interface DashboardFeatureSupport {
  /** Linux `/proc` 기반 CPU·메모리·네트워크 */
  systemResources: boolean;
  /** 루트 1depth `du` (macOS는 스캔 비용으로 미지원) */
  largeDirectories: boolean;
  /** 활동 피드 — 아직 미구현 */
  activity: boolean;
}

/** 원격 OS별 대시보드 섹션 노출 여부 */
export function dashboardFeatureSupport(
  os: RemoteOs | null | undefined,
): DashboardFeatureSupport {
  const isLinux = os === "linux";

  return {
    systemResources: isLinux,
    largeDirectories: isLinux,
    activity: false,
  };
}
