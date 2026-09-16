import { IconButton } from "@/components/common/IconButton";
import { PageToolbar } from "@/components/common/PageToolbar";
import { FolderUpIcon, RefreshIcon } from "@/components/icons/ToolbarIcons";
import { buildPathFromSegments, splitPathSegments } from "@/utils/file";

const BREADCRUMB_UNIQUE_DEPTH = 5;

function breadcrumbChipDepthClass(segmentIndex: number): string {
  const depth = segmentIndex + 1;
  if (depth <= BREADCRUMB_UNIQUE_DEPTH) {
    return `explorer-breadcrumb__chip--depth-${depth}`;
  }
  return "explorer-breadcrumb__chip--depth-deep";
}

interface FileExplorerToolbarProps {
  currentPath: string;
  isLoading: boolean;
  canGoUp: boolean;
  onGoUp: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}

export function FileExplorerToolbar({
  currentPath,
  isLoading,
  canGoUp,
  onGoUp,
  onRefresh,
  onNavigate,
}: FileExplorerToolbarProps) {
  const segments = splitPathSegments(currentPath);

  return (
    <PageToolbar
      actions={
        <>
          <IconButton
            tone="accent"
            tooltip="상위 폴더"
            disabled={!canGoUp || isLoading}
            onClick={onGoUp}
            aria-label="상위 폴더"
          >
            <FolderUpIcon />
          </IconButton>
          <IconButton
            tone="success"
            tooltip="새로고침"
            disabled={isLoading}
            onClick={onRefresh}
            aria-label="새로고침"
          >
            <RefreshIcon />
          </IconButton>
        </>
      }
    >
      <nav className="explorer-breadcrumb" aria-label="경로">
        <button
          type="button"
          className="explorer-breadcrumb__chip explorer-breadcrumb__chip--root"
          disabled={isLoading}
          onClick={() => onNavigate("/")}
        >
          /
        </button>
        {segments.map((segment, index) => (
          <button
            key={`${segment}-${index}`}
            type="button"
            className={[
              "explorer-breadcrumb__chip",
              breadcrumbChipDepthClass(index),
            ].join(" ")}
            disabled={isLoading}
            onClick={() =>
              onNavigate(buildPathFromSegments(segments.slice(0, index + 1)))
            }
          >
            {segment}
          </button>
        ))}
      </nav>
    </PageToolbar>
  );
}
