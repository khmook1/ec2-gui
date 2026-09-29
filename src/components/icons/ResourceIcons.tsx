import type { SVGProps } from "react";

type ResourceIconProps = SVGProps<SVGSVGElement>;

function ResourceSvg({ children, ...props }: ResourceIconProps) {
  return (
    <svg
      width="14"
      height="14"
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

/** CPU */
export function CpuIcon(props: ResourceIconProps) {
  return (
    <ResourceSvg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </ResourceSvg>
  );
}

/** 메모리 (RAM) */
export function MemoryIcon(props: ResourceIconProps) {
  return (
    <ResourceSvg {...props}>
      <rect x="2" y="6" width="20" height="10" rx="1.5" />
      <path d="M6 10v2M10 10v2M14 10v2M18 10v2" />
      <path d="M5 16v3M9 16v3M15 16v3M19 16v3" />
    </ResourceSvg>
  );
}

/** 디스크 */
export function DiskIcon(props: ResourceIconProps) {
  return (
    <ResourceSvg {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </ResourceSvg>
  );
}

/** 네트워크 (송수신) */
export function NetworkIcon(props: ResourceIconProps) {
  return (
    <ResourceSvg {...props}>
      <path d="M7 3v14" />
      <path d="m3 13 4 4 4-4" />
      <path d="M17 21V7" />
      <path d="m21 11-4-4-4 4" />
    </ResourceSvg>
  );
}
