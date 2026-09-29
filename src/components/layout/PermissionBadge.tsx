import { useState, type ComponentType, type SVGProps } from "react";
import {
  ChevronRightSmallIcon,
  LimitedPermissionIcon,
  RootPermissionIcon,
  SudoPermissionIcon,
  UnknownPermissionIcon,
  UserPermissionIcon,
} from "@/components/icons/PermissionIcons";
import { PermissionsDialog } from "@/components/permissions/PermissionsDialog";
import {
  permissionBadge,
  permissionLevel,
  type PermissionLevel,
} from "@/components/permissions/utils/permissionUi";
import { usePermissionOverviewQuery } from "@/hooks/query";

const LEVEL_ICONS: Record<
  PermissionLevel,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  root: RootPermissionIcon,
  sudo: SudoPermissionIcon,
  limited: LimitedPermissionIcon,
  user: UserPermissionIcon,
};

export function PermissionBadge() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: permissions, isPending, isError } =
    usePermissionOverviewQuery();

  const level = permissions ? permissionLevel(permissions) : null;
  const tone = isError ? "error" : (level ?? "pending");
  const label = isError
    ? "확인 실패"
    : isPending
      ? "확인 중…"
      : (permissionBadge(permissions ?? null) ?? "알 수 없음");
  const Icon = level && !isError ? LEVEL_ICONS[level] : UnknownPermissionIcon;

  return (
    <>
      <button
        type="button"
        className={[
          "header__permission",
          `header__permission--${tone}`,
          dialogOpen ? "header__permission--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`내 권한: ${label} (상세 보기)`}
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        title="권한 상세 보기"
        onClick={() => setDialogOpen(true)}
      >
        <span className="header__permission-icon-wrap">
          <Icon className="header__permission-icon" />
        </span>
        <span className="header__permission-label">{label}</span>
        <ChevronRightSmallIcon className="header__permission-chevron" />
      </button>
      {dialogOpen ? (
        <PermissionsDialog open onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}
