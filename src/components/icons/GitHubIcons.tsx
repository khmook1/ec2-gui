import { ToolbarSvg, type ToolbarIconProps } from "./ToolbarIcons";

export function ArrowLeftIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </ToolbarSvg>
  );
}

export function ExternalLinkIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </ToolbarSvg>
  );
}

export function CodeIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </ToolbarSvg>
  );
}

export function IssueIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </ToolbarSvg>
  );
}

export function PullRequestIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M18 15.5V9a3 3 0 0 0-3-3h-4" />
      <path d="m13 3-3 3 3 3" />
    </ToolbarSvg>
  );
}

export function BranchIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <path d="M6 7.5v9" />
      <path d="M18 9.5c0 4-6 3-11 7" />
    </ToolbarSvg>
  );
}

export function GearIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </ToolbarSvg>
  );
}

export function FolderIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </ToolbarSvg>
  );
}

export function FileIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </ToolbarSvg>
  );
}

export function StarIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />
    </ToolbarSvg>
  );
}

export function ForkIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="12" cy="19" r="2.5" />
      <path d="M6 7.5V9a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.5" />
      <path d="M12 12v4.5" />
    </ToolbarSvg>
  );
}

export function WatchIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </ToolbarSvg>
  );
}

export function CommentIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </ToolbarSvg>
  );
}
