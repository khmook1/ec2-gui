import type { SVGProps } from "react";

type NavIconProps = SVGProps<SVGSVGElement>;

function NavSvg({ children, ...props }: NavIconProps) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

export function FileExplorerNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M3 11h18" />
    </NavSvg>
  );
}

export function DockerNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7.4" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="11.8" y="11" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="7.4" y="6.6" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="11.8" y="6.6" width="3.2" height="3.2" rx="0.5" fill="currentColor" stroke="none" />
      <path d="M2 15.5h14a4 4 0 0 0 3.9-3.1L21 9.5" />
    </NavSvg>
  );
}

export function LogOutNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </NavSvg>
  );
}

export function DashboardNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </NavSvg>
  );
}

export function MenuNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </NavSvg>
  );
}

export function SettingsNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </NavSvg>
  );
}
