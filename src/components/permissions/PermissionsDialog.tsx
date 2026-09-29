import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "@/components/common/AppDialog";
import { IconButton } from "@/components/common/IconButton";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { MyPermissionsPanel } from "@/components/permissions/MyPermissionsPanel";
import { UserAdminSection } from "@/components/permissions/UserAdminSection";
import {
  canGrantPermissions,
  permissionErrorMessage,
} from "@/components/permissions/utils/permissionUi";
import {
  useDiskOverviewQuery,
  usePermissionOverviewQuery,
  useSessionKey,
} from "@/hooks/query";
import { queryKeys } from "@/hooks/query/keys";
import "./css/permissions.css";

interface PermissionsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PermissionsDialog({ open, onClose }: PermissionsDialogProps) {
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();
  const permissionQuery = usePermissionOverviewQuery();
  const diskQuery = useDiskOverviewQuery();
  const userAdminFetching = useIsFetching({ queryKey: ["permissions"] });
  const [nestedDialogOpen, setNestedDialogOpen] = useState(false);

  const permissions = permissionQuery.data ?? null;
  const permissionError = permissionQuery.isError
    ? permissionErrorMessage(
        permissionQuery.error,
        "권한 정보를 불러오지 못했습니다.",
      )
    : null;
  const showUserAdmin =
    canGrantPermissions(permissions) && diskQuery.data?.os === "linux";
  const refreshing = permissionQuery.isFetching || userAdminFetching > 0;

  const refreshAll = () => {
    void permissionQuery.refetch();
    if (sessionKey) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.remoteUsers(sessionKey),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.remoteGroups(sessionKey),
      });
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="권한"
      subtitle={permissions ? `${permissions.username} · uid ${permissions.uid}` : null}
      size="wide"
      busy={refreshing}
      // 하위 다이얼로그가 열려 있으면 Escape 가 부모까지 닫지 않도록 막는다.
      closeDisabled={nestedDialogOpen}
      bodyClassName="perm-main-dialog__body"
      headerActions={
        <IconButton
          tone="success"
          tooltip="새로고침"
          tooltipPosition="bottom"
          aria-label="새로고침"
          disabled={refreshing}
          onClick={refreshAll}
        >
          <RefreshIcon />
        </IconButton>
      }
    >
      <section className="perm-main-dialog__section" aria-label="내 권한">
        <h3 className="perm-main-dialog__heading">내 권한</h3>
        <MyPermissionsPanel
          permissions={permissions}
          loading={permissionQuery.isPending}
          error={permissionError}
        />
      </section>

      {showUserAdmin ? (
        <UserAdminSection onNestedDialogChange={setNestedDialogOpen} />
      ) : null}
    </AppDialog>
  );
}
