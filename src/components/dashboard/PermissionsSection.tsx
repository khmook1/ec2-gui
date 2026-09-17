import type {
  RemotePermissionOverview,
  SudoAccess,
} from "@/types/permissions";
import "./css/dashboard.css";

interface PermissionsSectionProps {
  permissions: RemotePermissionOverview | null;
  loading: boolean;
  error: string | null;
}

type CapabilityTone = "granted" | "limited" | "denied";

interface CapabilityRow {
  id: string;
  label: string;
  detail: string;
  tone: CapabilityTone;
}

function sudoLabel(sudo: SudoAccess): { detail: string; tone: CapabilityTone } {
  switch (sudo) {
    case "root":
      return { detail: "루트 계정 · 전체 권한", tone: "granted" };
    case "passwordless":
      return { detail: "비밀번호 없이 sudo 가능", tone: "granted" };
    case "group":
      return { detail: "sudo/wheel 그룹 · 비밀번호 필요할 수 있음", tone: "limited" };
    case "none":
    default:
      return { detail: "sudo 권한 없음", tone: "denied" };
  }
}

function buildCapabilities(
  permissions: RemotePermissionOverview,
): CapabilityRow[] {
  const sudo = sudoLabel(permissions.sudo);

  return [
    {
      id: "account",
      label: "계정 수준",
      detail: permissions.isRoot
        ? "루트 (uid 0)"
        : `일반 사용자 · uid ${permissions.uid}`,
      tone: permissions.isRoot ? "granted" : "limited",
    },
    {
      id: "sudo",
      label: "sudo",
      detail: sudo.detail,
      tone: sudo.tone,
    },
    {
      id: "docker",
      label: "Docker",
      detail: permissions.dockerAccess
        ? "소켓·그룹 접근 가능"
        : "Docker 소켓 접근 불가",
      tone: permissions.dockerAccess ? "granted" : "denied",
    },
    {
      id: "home",
      label: "홈 디렉터리",
      detail: permissions.canWriteHome
        ? `${permissions.home || "—"} · 쓰기 가능`
        : `${permissions.home || "—"} · 쓰기 불가`,
      tone: permissions.canWriteHome ? "granted" : "denied",
    },
  ];
}

function toneBadge(tone: CapabilityTone): string {
  switch (tone) {
    case "granted":
      return "허용";
    case "limited":
      return "제한";
    case "denied":
      return "없음";
  }
}

export function PermissionsSection({
  permissions,
  loading,
  error,
}: PermissionsSectionProps) {
  if (loading && !permissions) {
    return (
      <div
        className="dashboard-skeleton"
        aria-busy="true"
        aria-label="불러오는 중"
      >
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
        <div className="dashboard-skeleton__block" />
      </div>
    );
  }

  if (error && !permissions) {
    return (
      <p
        className="dashboard-section__status dashboard-section__status--error"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (!permissions) {
    return (
      <p className="dashboard-section__status" role="status">
        권한 정보 없음
      </p>
    );
  }

  const capabilities = buildCapabilities(permissions);
  const avatarLetter = permissions.username.slice(0, 1).toUpperCase() || "?";
  const secondaryGroups = permissions.groups.filter(
    (group) => group !== permissions.primaryGroup,
  );
  const hasGroups =
    Boolean(permissions.primaryGroup) || secondaryGroups.length > 0;

  return (
    <div className="dashboard-permissions">
      {error ? (
        <p
          className="dashboard-section__status dashboard-section__status--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="dashboard-permissions__identity">
        <span className="dashboard-permissions__avatar" aria-hidden>
          {avatarLetter}
        </span>
        <div className="dashboard-permissions__profile">
          <div className="dashboard-permissions__user">
            <span className="dashboard-permissions__username">
              {permissions.username}
            </span>
            <span className="dashboard-permissions__uid">
              uid {permissions.uid}
            </span>
          </div>
          <div
            className="dashboard-permissions__chips"
            aria-label="소속 그룹"
          >
            {permissions.primaryGroup ? (
              <span className="dashboard-permissions__chip dashboard-permissions__chip--primary">
                {permissions.primaryGroup}
              </span>
            ) : null}
            {secondaryGroups.map((group) => (
              <span key={group} className="dashboard-permissions__chip">
                {group}
              </span>
            ))}
            {!hasGroups ? (
              <span className="dashboard-permissions__chip">그룹 없음</span>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="dashboard-permissions__list" aria-label="권한 범위">
        {capabilities.map((item) => (
          <li
            key={item.id}
            className={`dashboard-perm dashboard-perm--${item.tone}`}
          >
            <div className="dashboard-perm__body">
              <div className="dashboard-perm__label">{item.label}</div>
              <div className="dashboard-perm__detail">{item.detail}</div>
            </div>
            <span className="dashboard-perm__badge">{toneBadge(item.tone)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
