import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { UserTable } from "@/components/permissions/atoms/UserTable";
import {
  CreateUserDialog,
  type CreateUserFormResult,
} from "@/components/permissions/CreateUserDialog";
import { DeleteUserDialog } from "@/components/permissions/DeleteUserDialog";
import { UserGroupsDialog } from "@/components/permissions/UserGroupsDialog";
import { permissionErrorMessage } from "@/components/permissions/utils/permissionUi";
import {
  useCreateRemoteUserMutation,
  useDeleteRemoteUserMutation,
  useRemoteGroupsQuery,
  useRemoteUsersQuery,
  useSetRemoteUserPasswordlessSudoMutation,
  useUpdateRemoteUserGroupsMutation,
} from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import type { RemoteUser } from "@/types/permissions";
import "./css/permissions.css";

interface UserAdminSectionProps {
  onNestedDialogChange?: (open: boolean) => void;
}

export function UserAdminSection({ onNestedDialogChange }: UserAdminSectionProps) {
  const toast = useToast();
  const usersQuery = useRemoteUsersQuery();
  const groupsQuery = useRemoteGroupsQuery();
  const updateGroups = useUpdateRemoteUserGroupsMutation();
  const setNopasswd = useSetRemoteUserPasswordlessSudoMutation();
  const createUser = useCreateRemoteUserMutation();
  const deleteUser = useDeleteRemoteUserMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [groupsTarget, setGroupsTarget] = useState<RemoteUser | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemoteUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const nestedDialogOpen =
    createOpen || groupsTarget != null || deleteTarget != null;

  useEffect(() => {
    onNestedDialogChange?.(nestedDialogOpen);
  }, [nestedDialogOpen, onNestedDialogChange]);

  useEffect(() => {
    return () => onNestedDialogChange?.(false);
  }, [onNestedDialogChange]);

  const users = usersQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const busy =
    updateGroups.isPending ||
    setNopasswd.isPending ||
    createUser.isPending ||
    deleteUser.isPending;

  const usersError = usersQuery.isError
    ? permissionErrorMessage(usersQuery.error, "사용자 목록을 불러오지 못했습니다.")
    : null;

  async function handleCreate(values: CreateUserFormResult) {
    setCreateError(null);
    try {
      await createUser.mutateAsync({
        username: values.username,
        shell: values.shell,
        groups: values.groups,
        sshPublicKey: values.sshPublicKey,
      });
    } catch (error) {
      setCreateError(
        permissionErrorMessage(error, "사용자를 추가하지 못했습니다."),
      );
      return;
    }

    setCreateOpen(false);
    toast.success(`${values.username} 사용자를 추가했습니다.`);

    if (values.grantNopasswd) {
      try {
        await setNopasswd.mutateAsync({
          username: values.username,
          enabled: true,
        });
      } catch (error) {
        toast.error(
          permissionErrorMessage(error, "sudo 권한을 부여하지 못했습니다."),
        );
      }
    }
  }

  async function handleUpdateGroups(changes: { add: string[]; remove: string[] }) {
    if (!groupsTarget) {
      return;
    }
    setGroupsError(null);
    try {
      await updateGroups.mutateAsync({
        username: groupsTarget.username,
        ...changes,
      });
      toast.success(`${groupsTarget.username}의 그룹을 변경했습니다.`);
      setGroupsTarget(null);
    } catch (error) {
      setGroupsError(permissionErrorMessage(error, "그룹을 변경하지 못했습니다."));
    }
  }

  async function handleToggleNopasswd(user: RemoteUser, enabled: boolean) {
    try {
      await setNopasswd.mutateAsync({ username: user.username, enabled });
      toast.success(
        enabled
          ? `${user.username}에게 비밀번호 없는 sudo 권한을 부여했습니다.`
          : `${user.username}의 비밀번호 없는 sudo 권한을 회수했습니다.`,
      );
    } catch (error) {
      toast.error(permissionErrorMessage(error, "sudo 권한을 변경하지 못했습니다."));
    }
  }

  async function handleDelete({ removeHome }: { removeHome: boolean }) {
    if (!deleteTarget) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteUser.mutateAsync({
        username: deleteTarget.username,
        removeHome,
      });
      toast.success(`${deleteTarget.username} 사용자를 삭제했습니다.`);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        permissionErrorMessage(error, "사용자를 삭제하지 못했습니다."),
      );
    }
  }

  return (
    <section className="perm-main-dialog__section" aria-label="사용자 권한 관리">
      <div className="user-admin__toolbar">
        <div>
          <h3 className="perm-main-dialog__heading">
            사용자 권한 관리
            {usersQuery.isSuccess ? (
              <span className="perm-main-dialog__count">{users.length}명</span>
            ) : null}
          </h3>
          <p className="user-admin__hint">
            root와 일반 사용자(UID_MIN 이상) 계정만 표시합니다. 변경은 sudo로
            원격 서버에 즉시 반영됩니다.
          </p>
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          사용자 추가
        </Button>
      </div>

      {usersQuery.isPending ? (
        <div className="dashboard-skeleton" aria-busy="true" aria-label="불러오는 중">
          <div className="dashboard-skeleton__block" />
          <div className="dashboard-skeleton__block" />
        </div>
      ) : usersError && users.length === 0 ? (
        <p
          className="dashboard-section__status dashboard-section__status--error"
          role="alert"
        >
          {usersError}
        </p>
      ) : (
        <UserTable
          users={users}
          busy={busy}
          onEditGroups={(user) => {
            setGroupsError(null);
            setGroupsTarget(user);
          }}
          onToggleNopasswd={(user, enabled) => {
            void handleToggleNopasswd(user, enabled);
          }}
          onDelete={(user) => {
            setDeleteError(null);
            setDeleteTarget(user);
          }}
        />
      )}

      <CreateUserDialog
        open={createOpen}
        availableGroups={groups}
        existingUsernames={users.map((user) => user.username)}
        isSubmitting={createUser.isPending || setNopasswd.isPending}
        errorMessage={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <UserGroupsDialog
        user={groupsTarget}
        availableGroups={groups}
        isSubmitting={updateGroups.isPending}
        errorMessage={groupsError}
        onClose={() => setGroupsTarget(null)}
        onSubmit={handleUpdateGroups}
      />
      <DeleteUserDialog
        user={deleteTarget}
        isSubmitting={deleteUser.isPending}
        errorMessage={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
