import type { SVGProps } from "react";

type SectionIconProps = SVGProps<SVGSVGElement>;

function SectionSvg({ children, className, ...props }: SectionIconProps) {
  const classes = ["dashboard-section__icon", className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={classes}
      {...props}
    >
      {children}
    </svg>
  );
}

/** CPU · 메모리 · 네트워크 */
export function SystemResourcesSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 1v3" />
      <path d="M15 1v3" />
      <path d="M9 20v3" />
      <path d="M15 20v3" />
      <path d="M20 9h3" />
      <path d="M20 14h3" />
      <path d="M1 9h3" />
      <path d="M1 14h3" />
    </SectionSvg>
  );
}

/** Docker 컨테이너 */
export function DockerSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <rect x="3" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7.4" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="11.8" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7.4" y="6.6" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="11.8" y="6.6" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <path d="M2 15.5h14a4 4 0 0 0 3.9-3.1L21 9.5" />
    </SectionSvg>
  );
}

/** 대용량 디렉터리 */
export function LargeDirectoriesSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 11v6" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </SectionSvg>
  );
}

/** 권한 */
export function PermissionsSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z" />
      <path d="M9.5 12.5 11 14l3.5-3.5" />
    </SectionSvg>
  );
}

/** 스토리지 / 디스크 사용량 */
export function StorageSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </SectionSvg>
  );
}

/** 블록 디바이스 / lsblk */
export function BlockDevicesSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
    </SectionSvg>
  );
}

/** SSH 세션 */
export function SshSessionsSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 9 3 3-3 3" />
      <path d="M13 15h4" />
    </SectionSvg>
  );
}

/** 최근 활동 */
export function ActivitySectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </SectionSvg>
  );
}

/** 준비 중 */
export function ComingSoonSectionIcon(props: SectionIconProps) {
  return (
    <SectionSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </SectionSvg>
  );
}
