import { ActivityPlaceholder } from "@/components/dashboard/ActivityPlaceholder";
import { FeatureComingSoon } from "@/components/dashboard/FeatureComingSoon";
import { SectionCard } from "@/components/dashboard/atoms/SectionCard";
import { DiskCapacitySection } from "@/components/dashboard/DiskCapacitySection";
import { DockerOverviewSection } from "@/components/dashboard/DockerOverviewSection";
import { LargeDirectoriesSection } from "@/components/dashboard/LargeDirectoriesSection";
import { PermissionsSection } from "@/components/dashboard/PermissionsSection";
import { SshSessionsSection } from "@/components/dashboard/SshSessionsSection";
import { SystemResourcesSection } from "@/components/dashboard/SystemResourcesSection";
import type { DashboardLayoutProps } from "./types";

/** 레이아웃에서 재사용하는 섹션 카드 (OS별 조합용) */

export function ComingSoonCard({ label }: { label: string }) {
  return (
    <SectionCard title="기능 준비 중" badge="준비 중">
      <FeatureComingSoon label={label} />
    </SectionCard>
  );
}

export function SystemResourcesCard({
  systemResources,
  systemLoading,
  systemError,
}: Pick<
  DashboardLayoutProps,
  "systemResources" | "systemLoading" | "systemError"
>) {
  return (
    <SectionCard
      title="시스템 리소스"
      subtitle="실시간"
      badge={systemResources && !systemError ? "0.3s 샘플" : "준비 중"}
    >
      <SystemResourcesSection
        resources={systemResources}
        loading={systemLoading}
        error={systemError}
      />
    </SectionCard>
  );
}

export function DockerOverviewCard({
  dockerCounts,
  recentContainers,
  dockerLoading,
  dockerError,
  dockerBadge,
}: Pick<
  DashboardLayoutProps,
  | "dockerCounts"
  | "recentContainers"
  | "dockerLoading"
  | "dockerError"
  | "dockerBadge"
>) {
  return (
    <SectionCard title="Docker 컨테이너" subtitle="최근 활동" badge={dockerBadge}>
      <DockerOverviewSection
        counts={dockerCounts}
        recentContainers={recentContainers}
        loading={dockerLoading}
        error={dockerError}
      />
    </SectionCard>
  );
}

export function LargeDirectoriesCard({
  directories,
  diskLoading,
  diskError,
  subtitle = "루트 1depth",
}: Pick<DashboardLayoutProps, "directories" | "diskLoading" | "diskError"> & {
  subtitle?: string;
}) {
  return (
    <SectionCard
      title="용량이 큰 디렉터리"
      subtitle={subtitle}
      badge={
        !diskLoading && !diskError && directories.length > 0
          ? directories.length
          : null
      }
    >
      <LargeDirectoriesSection
        directories={directories}
        loading={diskLoading}
        error={diskError}
      />
    </SectionCard>
  );
}

export function PermissionsCard({
  permissions,
  permissionsLoading,
  permissionError,
  permissionsBadge,
}: Pick<
  DashboardLayoutProps,
  | "permissions"
  | "permissionsLoading"
  | "permissionError"
  | "permissionsBadge"
>) {
  return (
    <SectionCard
      title="내 권한"
      subtitle="접속 계정"
      badge={permissionsBadge}
    >
      <PermissionsSection
        permissions={permissions}
        loading={permissionsLoading}
        error={permissionError}
      />
    </SectionCard>
  );
}

export function StorageCard({
  filesystems,
  diskHistory,
  diskLoading,
  diskHistoryLoading,
  diskError,
  storageBadge,
  os,
}: Pick<
  DashboardLayoutProps,
  | "filesystems"
  | "diskHistory"
  | "diskLoading"
  | "diskHistoryLoading"
  | "diskError"
  | "storageBadge"
  | "os"
>) {
  return (
    <SectionCard title="스토리지" subtitle="마운트 포인트" badge={storageBadge}>
      <DiskCapacitySection
        filesystems={filesystems}
        history={diskHistory}
        loading={diskLoading || diskHistoryLoading}
        error={diskError}
        os={os}
      />
    </SectionCard>
  );
}

export function SshSessionsCard({
  sshSessions,
  sshLoading,
  sshError,
}: Pick<DashboardLayoutProps, "sshSessions" | "sshLoading" | "sshError">) {
  return (
    <SectionCard
      title="SSH 세션"
      subtitle="원격 로그인"
      badge={
        !sshLoading && !sshError
          ? `${sshSessions.length}개 활성`
          : "준비 중"
      }
    >
      <SshSessionsSection
        sessions={sshSessions}
        loading={sshLoading}
        error={sshError}
      />
    </SectionCard>
  );
}

export function ActivityCard() {
  return (
    <SectionCard title="최근 활동" badge="최신">
      <ActivityPlaceholder />
    </SectionCard>
  );
}
