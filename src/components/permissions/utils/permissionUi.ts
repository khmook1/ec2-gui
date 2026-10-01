import type { RemotePermissionOverview } from "@/types/permissions";

export type PermissionLevel = "root" | "sudo" | "limited" | "user";

export function permissionLevel(
  permissions: RemotePermissionOverview,
): PermissionLevel {
  if (permissions.isRoot || permissions.sudo === "root") {
    return "root";
  }
  if (permissions.sudo === "passwordless") {
    return "sudo";
  }
  if (permissions.sudo === "group") {
    return "limited";
  }
  return "user";
}

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  root: "root",
  sudo: "sudo",
  limited: "제한 sudo",
  user: "일반",
};

export function permissionBadge(
  permissions: RemotePermissionOverview | null,
): string | null {
  if (!permissions) {
    return null;
  }
  return LEVEL_LABELS[permissionLevel(permissions)];
}

export const SUDO_GROUPS = ["sudo", "wheel", "admin"] as const;

const PRIORITY_GROUPS = [...SUDO_GROUPS, "docker", "adm", "systemd-journal"];

export function isSudoGroup(group: string): boolean {
  return (SUDO_GROUPS as readonly string[]).includes(group);
}

export function isPriorityGroup(group: string): boolean {
  return PRIORITY_GROUPS.includes(group);
}

/** sudo·docker 등 권한과 직결된 그룹을 앞에 둔다. */
export function sortGroupsByPriority(groups: readonly string[]): string[] {
  return [...groups].sort((a, b) => {
    const rankA = PRIORITY_GROUPS.indexOf(a);
    const rankB = PRIORITY_GROUPS.indexOf(b);
    if (rankA !== rankB) {
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      return rankA - rankB;
    }
    return a.localeCompare(b);
  });
}

/** react-hook-form 체크박스 그룹 값은 선택 수에 따라 boolean/string 으로 올 수 있다. */
export function toCheckedList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? [value] : [];
}

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;

/** 백엔드 chpasswd 검증과 같은 규칙. 비밀번호는 trim 하지 않는다. */
export function validateUserPassword(value: string): true | string {
  if (/[\r\n\0]/.test(value)) {
    return "비밀번호에 줄바꿈 문자를 넣을 수 없습니다.";
  }
  const length = [...value].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  }
  return true;
}

export function permissionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return fallback;
}

/** 비대화형 SSH에서 sudo를 실행할 수 있어야 사용자·그룹을 변경할 수 있다. */
export function canGrantPermissions(
  permissions: RemotePermissionOverview | null,
): boolean {
  if (!permissions) {
    return false;
  }
  return (
    permissions.isRoot ||
    permissions.sudo === "root" ||
    permissions.sudo === "passwordless"
  );
}
