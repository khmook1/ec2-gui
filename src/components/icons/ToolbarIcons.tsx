import type { SVGProps } from "react";

export type ToolbarIconProps = SVGProps<SVGSVGElement>;

/** 툴바 IconButton 안에서 쓰는 SVG 공통 베이스 */
export function ToolbarSvg({
  children,
  className,
  ...props
}: ToolbarIconProps) {
  const classes = ["toolbar-icon", className].filter(Boolean).join(" ");

  return (
    <svg
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

export function FolderUpIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </ToolbarSvg>
  );
}

export function RefreshIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </ToolbarSvg>
  );
}

/** 테이블/리스트 보기 */
export function TableListViewIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </ToolbarSvg>
  );
}

/** GUI/카드 그리드 보기 */
export function GuiViewIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </ToolbarSvg>
  );
}

/** 터미널 패널 토글 */
export function TerminalIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h4" />
      <path d="M7 13h8" />
      <path d="M7 17h6" />
    </ToolbarSvg>
  );
}

/** 추가(+) */
export function PlusIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </ToolbarSvg>
  );
}

/** 미사용 리소스 정리 (prune) */
export function PruneIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </ToolbarSvg>
  );
}
