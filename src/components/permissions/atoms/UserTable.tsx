import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import {
  isPriorityGroup,
  sortGroupsByPriority,
} from "@/components/permissions/utils/permissionUi";
import type { RemoteUser } from "@/types/permissions";

interface UserTableProps {
  users: RemoteUser[];
  busy: boolean;
  onEditGroups: (user: RemoteUser) => void;
  onToggleNopasswd: (user: RemoteUser, enabled: boolean) => void;
  onSetPassword: (user: RemoteUser) => void;
  onDelete: (user: RemoteUser) => void;
}

function sudoStatus(user: RemoteUser): { label: string; tone: string } {
  if (user.uid === 0) {
    return { label: "root", tone: "granted" };
  }
  if (user.nopasswdSudo) {
    return {
      label: user.managedSudo ? "NOPASSWD (앱 부여)" : "NOPASSWD",
      tone: "granted",
    };
  }
  if (user.hasSudoGroup) {
    return { label: "sudo 그룹", tone: "limited" };
  }
  return { label: "없음", tone: "denied" };
}

function NopasswdAction({
  user,
  busy,
  onToggle,
}: {
  user: RemoteUser;
  busy: boolean;
  onToggle: (user: RemoteUser, enabled: boolean) => void;
}) {
  if (user.managedSudo) {
    return (
      <Button
        variant="ghost"
        disabled={busy || user.isCurrent}
        title={
          user.isCurrent
            ? "현재 접속 계정의 sudo 권한은 회수할 수 없습니다"
            : undefined
        }
        onClick={() => onToggle(user, false)}
      >
        sudo 회수
      </Button>
    );
  }

  if (user.nopasswdSudo) {
    return (
      <Button
        variant="ghost"
        disabled
        title="다른 sudoers 설정(예: cloud-init)으로 부여되어 여기서 회수할 수 없습니다"
      >
        sudo 회수
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() => onToggle(user, true)}
    >
      sudo 부여
    </Button>
  );
}

export function UserTable({
  users,
  busy,
  onEditGroups,
  onToggleNopasswd,
  onSetPassword,
  onDelete,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <p className="dashboard-section__status" role="status">
        표시할 사용자가 없습니다.
      </p>
    );
  }

  return (
    <div className="user-table__scroll">
      <table className="user-table">
        <thead>
          <tr>
            <th scope="col">사용자</th>
            <th scope="col">UID</th>
            <th scope="col">셸</th>
            <th scope="col">그룹</th>
            <th scope="col">sudo</th>
            <th scope="col" className="user-table__actions-head">
              작업
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isRoot = user.uid === 0;
            const status = sudoStatus(user);
            return (
              <tr
                key={user.username}
                className={user.isCurrent ? "user-table__row--current" : undefined}
              >
                <td>
                  <div className="user-table__name">
                    <span>{user.username}</span>
                    {user.isCurrent ? (
                      <span className="user-table__tag">현재 계정</span>
                    ) : null}
                  </div>
                  <div className="user-table__home">{user.home}</div>
                </td>
                <td className="user-table__mono">{user.uid}</td>
                <td className="user-table__mono">{user.shell}</td>
                <td>
                  <div className="user-table__groups">
                    {sortGroupsByPriority(user.groups).map((group) => (
                      <span
                        key={group}
                        className={[
                          "perm-chip",
                          isPriorityGroup(group) ? "perm-chip--primary" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`user-table__status user-table__status--${status.tone}`}>
                    {status.label}
                  </span>
                </td>
                <td>
                  {isRoot ? (
                    <span className="user-table__muted">변경 불가</span>
                  ) : (
                    <div className="user-table__actions">
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onEditGroups(user)}
                      >
                        그룹 편집
                      </Button>
                      <NopasswdAction
                        user={user}
                        busy={busy}
                        onToggle={onToggleNopasswd}
                      />
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onSetPassword(user)}
                      >
                        비밀번호
                      </Button>
                      <DangerButton
                        disabled={busy || user.isCurrent}
                        title={
                          user.isCurrent
                            ? "현재 접속 계정은 삭제할 수 없습니다"
                            : undefined
                        }
                        onClick={() => onDelete(user)}
                      >
                        삭제
                      </DangerButton>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
