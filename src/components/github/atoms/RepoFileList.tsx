import { FileIcon, FolderIcon } from "@/components/icons/GitHubIcons";
import { formatFileSize } from "@/utils/file";
import type { GitHubContentEntry } from "@/types/github";

interface RepoFileListProps {
  entries: GitHubContentEntry[];
  /** 루트가 아니면 상위 폴더 행을 보여 준다 */
  canGoUp: boolean;
  onGoUp: () => void;
  onOpen: (entry: GitHubContentEntry) => void;
}

export function RepoFileList({
  entries,
  canGoUp,
  onGoUp,
  onOpen,
}: RepoFileListProps) {
  return (
    <ul className="github-files" role="list">
      {canGoUp ? (
        <li>
          <button type="button" className="github-files__row" onClick={onGoUp}>
            <FolderIcon className="github-files__icon github-files__icon--dir" />
            <span className="github-files__name">..</span>
          </button>
        </li>
      ) : null}
      {entries.map((entry) => {
        const isDir = entry.kind === "dir";
        const openable = isDir || entry.kind === "file" || entry.kind === "symlink";
        return (
          <li key={entry.path}>
            <button
              type="button"
              className="github-files__row"
              disabled={!openable}
              title={entry.kind === "submodule" ? "서브모듈은 열 수 없습니다" : entry.path}
              onClick={() => onOpen(entry)}
            >
              {isDir || entry.kind === "submodule" ? (
                <FolderIcon className="github-files__icon github-files__icon--dir" />
              ) : (
                <FileIcon className="github-files__icon" />
              )}
              <span className="github-files__name">{entry.name}</span>
              <span className="github-files__size">
                {entry.kind === "file" ? formatFileSize(entry.size) : ""}
              </span>
            </button>
          </li>
        );
      })}
      {entries.length === 0 && !canGoUp ? (
        <li className="github-files__empty">빈 저장소입니다.</li>
      ) : null}
    </ul>
  );
}
