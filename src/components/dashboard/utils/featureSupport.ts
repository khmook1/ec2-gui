import type { RemoteOs } from "@/types/disk";

export interface DashboardFeatureSupport {
  /** Linux `/proc` 기반 CPU·메모리·네트워크 */
  systemResources: boolean;
  /** 루트 1depth `du` (macOS는 스캔 비용으로 미지원) */
  largeDirectories: boolean;
  /** 활동 피드 — 아직 미구현 */
  activity: boolean;
}

/** 원격 OS별 쿼리·기능 활성화 여부 (레이아웃 노출은 OS Layout이 담당) */
export function dashboardFeatureSupport(
  os: RemoteOs | null | undefined,
): DashboardFeatureSupport {
  switch (os) {
    case "linux":
      return {
        systemResources: true,
        largeDirectories: true,
        activity: false,
      };
    case "macos":
    case "windows":
    case "unknown":
    default:
      return {
        systemResources: false,
        largeDirectories: false,
        activity: false,
      };
  }
}
