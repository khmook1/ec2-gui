import type { RemoteOs } from "@/types/disk";
import { LinuxLayout } from "./LinuxLayout";
import { MacLayout } from "./MacLayout";
import { UnknownLayout } from "./UnknownLayout";
import { WindowsLayout } from "./WindowsLayout";
import type { DashboardLayoutProps } from "./types";

/** 원격 OS에 맞는 대시보드 레이아웃을 렌더합니다. */
export function DashboardOsLayout({
  os,
  ...props
}: DashboardLayoutProps & { os: RemoteOs | null | undefined }) {
  switch (os) {
    case "linux":
      return <LinuxLayout {...props} />;
    case "macos":
      return <MacLayout {...props} />;
    case "windows":
      return <WindowsLayout {...props} />;
    default:
      return <UnknownLayout {...props} />;
  }
}
