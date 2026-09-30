import { ActivityPlaceholder } from "@/components/dashboard/ActivityPlaceholder";
import { FeatureComingSoon } from "@/components/dashboard/FeatureComingSoon";
import { BlockDevicesSection } from "@/components/dashboard/atoms/BlockDevicesSection";
import { SectionCard } from "@/components/dashboard/atoms/SectionCard";
import { DiskCapacitySection } from "@/components/dashboard/DiskCapacitySection";
import { DockerOverviewSection } from "@/components/dashboard/DockerOverviewSection";
import { LargeDirectoriesSection } from "@/components/dashboard/LargeDirectoriesSection";
import { ResourceOverviewSection } from "@/components/dashboard/ResourceOverviewSection";
import { SshSessionsSection } from "@/components/dashboard/SshSessionsSection";
import { SystemResourcesSection } from "@/components/dashboard/SystemResourcesSection";
import {
  ActivitySectionIcon,
  BlockDevicesSectionIcon,
  ComingSoonSectionIcon,
  DockerSectionIcon,
  LargeDirectoriesSectionIcon,
  SshSessionsSectionIcon,
  StorageSectionIcon,
  SystemResourcesSectionIcon,
} from "@/components/icons/DashboardSectionIcons";
import type { DashboardLayoutProps } from "./types";

/** 레이아웃에서 재사용하는 섹션 카드 (OS별 조합용) */

export function ComingSoonCard({ label }: { label: string }) {
  return (
    <SectionCard
      title="기능 준비 중"
      badge="준비 중"
      icon={<ComingSoonSectionIcon />}
    >
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
      icon={<SystemResourcesSectionIcon />}
    >
      <SystemResourcesSection
        resources={systemResources}
        loading={systemLoading}
        error={systemError}
      />
    </SectionCard>
  );
}

export function ResourceOverviewCard({
  systemResources,
  systemLoading,
  systemError,
  filesystems,
  diskLoading,
  diskError,
  storageBadge,
  os,
}: Pick<
  DashboardLayoutProps,
  | "systemResources"
  | "systemLoading"
  | "systemError"
  | "filesystems"
  | "diskLoading"
  | "diskError"
  | "storageBadge"
  | "os"
>) {
  const error = [systemError, diskError].filter(Boolean).join(" · ") || null;

  return (
    <SectionCard
      title="리소스 개요"
      subtitle="10초 샘플 · 최근 30일"
      badge={storageBadge}
      icon={<SystemResourcesSectionIcon />}
      className="dashboard-section--overview"
    >
      <ResourceOverviewSection
        resources={systemResources}
        filesystems={filesystems}
        os={os}
        loading={systemLoading || diskLoading}
        error={error}
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
    <SectionCard
      title="컨테이너"
      subtitle="최근 활동"
      badge={dockerBadge}
      icon={<DockerSectionIcon />}
    >
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
  directoriesLoading,
  directoriesError,
  subtitle = "루트 1depth",
}: Pick<
  DashboardLayoutProps,
  "directories" | "directoriesLoading" | "directoriesError"
> & {
  subtitle?: string;
}) {
  return (
    <SectionCard
      title="용량이 큰 디렉터리"
      subtitle={subtitle}
      badge={
        !directoriesLoading && !directoriesError && directories.length > 0
          ? directories.length
          : null
      }
      icon={<LargeDirectoriesSectionIcon />}
    >
      <LargeDirectoriesSection
        directories={directories}
        loading={directoriesLoading}
        error={directoriesError}
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
    <SectionCard
      title="스토리지"
      subtitle="마운트 포인트"
      badge={storageBadge}
      icon={<StorageSectionIcon />}
    >
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

export function BlockDevicesCard({
  blockDevices,
  blockDevicesLoading,
  blockDevicesError,
  onExpandDisk,
}: Pick<
  DashboardLayoutProps,
  | "blockDevices"
  | "blockDevicesLoading"
  | "blockDevicesError"
  | "onExpandDisk"
>) {
  return (
    <SectionCard
      title="블록 디바이스"
      subtitle="lsblk"
      badge={
        !blockDevicesLoading && !blockDevicesError && blockDevices.length > 0
          ? `${blockDevices.length}개`
          : null
      }
      icon={<BlockDevicesSectionIcon />}
    >
      <BlockDevicesSection
        devices={blockDevices}
        loading={blockDevicesLoading}
        error={blockDevicesError}
        onExpand={onExpandDisk}
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
      icon={<SshSessionsSectionIcon />}
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
    <SectionCard
      title="최근 활동"
      badge="최신"
      icon={<ActivitySectionIcon />}
    >
      <ActivityPlaceholder />
    </SectionCard>
  );
}
