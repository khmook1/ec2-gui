import type { SVGProps } from "react";

type PermissionIconProps = SVGProps<SVGSVGElement>;

function PermissionSvg({ children, ...props }: PermissionIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** root — 왕관 */
export function RootPermissionIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <path
        d="M3 8.5 7.5 12 12 5.5l4.5 6.5L21 8.5 19.2 17H4.8L3 8.5Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M5 20.5h14" />
      <circle cx="3" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="21" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </PermissionSvg>
  );
}

/** sudo(NOPASSWD) — 번개 방패 */
export function SudoPermissionIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <path
        d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 9.9 4.4-1.5 7.5-5.3 7.5-9.9v-6L12 2.5Z"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path
        d="M13 7 9.5 12.5h3.2L11 17l3.5-5.5h-3.2L13 7Z"
        fill="currentColor"
        strokeWidth="1.2"
      />
    </PermissionSvg>
  );
}

/** 비밀번호가 필요한 sudo — 절반 채운 방패 */
export function LimitedPermissionIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 9.9 4.4-1.5 7.5-5.3 7.5-9.9v-6L12 2.5Z" />
      <path
        d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 9.9V2.5Z"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="none"
      />
      <circle cx="15.2" cy="10.5" r="1.6" />
      <path d="M15.2 12.1v2.6" />
    </PermissionSvg>
  );
}

/** 일반 사용자 */
export function UserPermissionIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <circle cx="12" cy="8" r="3.8" fill="currentColor" fillOpacity="0.22" />
      <path d="M4.5 20.5c1.3-3.6 4.2-5.7 7.5-5.7s6.2 2.1 7.5 5.7" />
    </PermissionSvg>
  );
}

/** 확인 중 / 실패 */
export function UnknownPermissionIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 9.9 4.4-1.5 7.5-5.3 7.5-9.9v-6L12 2.5Z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="15.8" r="0.9" fill="currentColor" stroke="none" />
    </PermissionSvg>
  );
}

export function ChevronRightSmallIcon(props: PermissionIconProps) {
  return (
    <PermissionSvg {...props}>
      <path d="m9 6 6 6-6 6" />
    </PermissionSvg>
  );
}
