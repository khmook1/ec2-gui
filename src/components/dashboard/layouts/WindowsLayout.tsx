import {
  ComingSoonCard,
  PermissionsCard,
  SshSessionsCard,
  StorageCard,
} from "./SectionCards";
import type { DashboardLayoutProps } from "./types";

/**
 * Windows 원격 호스트용 대시보드.
 * 명령어·지원 기능이 Linux/macOS와 달라 전용 섹션은 점진적으로 추가합니다.
 */
export function WindowsLayout(props: DashboardLayoutProps) {
  return (
    <div className="dashboard-grid">
      <div className="dashboard-grid__left">
        <ComingSoonCard label="Windows 전용 기능 준비 중" />
      </div>

      <div className="dashboard-grid__right">
        <PermissionsCard
          permissions={props.permissions}
          permissionsLoading={props.permissionsLoading}
          permissionError={props.permissionError}
          permissionsBadge={props.permissionsBadge}
        />
        <StorageCard
          filesystems={props.filesystems}
          diskHistory={props.diskHistory}
          diskLoading={props.diskLoading}
          diskHistoryLoading={props.diskHistoryLoading}
          diskError={props.diskError}
          storageBadge={props.storageBadge}
        />
        <SshSessionsCard
          sshSessions={props.sshSessions}
          sshLoading={props.sshLoading}
          sshError={props.sshError}
        />
      </div>
    </div>
  );
}
