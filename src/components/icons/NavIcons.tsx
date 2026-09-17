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

export function DockerContainersNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="4" width="7" height="7" rx="1.2" />
      <rect x="14" y="4" width="7" height="7" rx="1.2" />
      <rect x="3" y="13" width="7" height="7" rx="1.2" />
      <rect x="14" y="13" width="7" height="7" rx="1.2" />
    </NavSvg>
  );
}

export function DockerImagesNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </NavSvg>
  );
}

export function DockerNetworksNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 7.5v4.5" />
      <path d="m10.5 12-4 5" />
      <path d="m13.5 12 4 5" />
    </NavSvg>
  );
}

export function DockerVolumesNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </NavSvg>
  );
}

export function DockerSystemNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.9 4.9 2.8 2.8" />
      <path d="m16.3 16.3 2.8 2.8" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.9 19.1 2.8-2.8" />
      <path d="m16.3 7.7 2.8-2.8" />
      <circle cx="12" cy="12" r="3.5" />
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

export function ChevronDownNavIcon(props: NavIconProps) {
  return (
    <NavSvg {...props}>
      <path d="M6 9l6 6 6-6" />
    </NavSvg>
  );
}
