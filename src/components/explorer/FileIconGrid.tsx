import type { MouseEvent } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { useFilteredRemoteEntries } from "@/lib/useFilteredRemoteEntries";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { RemoteEntry } from "@/types/filesystem";
import "./css/file-icon-grid.css";

interface FileIconGridProps {
  entries: RemoteEntry[];
  isLoading: boolean;
  onOpenEntry: (entry: RemoteEntry) => void;
  onEntryContextMenu?: (event: MouseEvent, entry: RemoteEntry | null) => void;
}

function GridIcon({ isDirectory }: { isDirectory: boolean }) {
  return (
    <span
      className={
        isDirectory
          ? "explorer-icon explorer-icon--folder explorer-icon--grid"
          : "explorer-icon explorer-icon--file explorer-icon--grid"
      }
      aria-hidden
    />
  );
}

export function FileIconGrid({
  entries,
  isLoading,
  onOpenEntry,
  onEntryContextMenu,
}: FileIconGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filteredEntries, query, emptyMessage } =
    useFilteredRemoteEntries(entries);

  if (isLoading && filteredEntries.length === 0) {
    return (
      <div className="explorer-icon-grid explorer-icon-grid--empty">
        <LoadingIndicator message="폴더 내용을 불러오는 중..." />
      </div>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
        onContextMenu={(event) => onEntryContextMenu?.(event, null)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={[
        "explorer-icon-grid",
        isLoading ? "explorer-icon-grid--loading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="list"
      aria-label="파일 아이콘 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
      onContextMenu={(event) => onEntryContextMenu?.(event, null)}
    >
      {filteredEntries.map((entry) => {
        const selected = selectedKey === entry.path;

        return (
          <button
            key={entry.path}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={isLoading}
            title={entry.name}
            aria-label={
              entry.isDirectory ? `${entry.name} 폴더` : `${entry.name} 파일`
            }
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(entry.path);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenEntry(entry);
            }}
            onContextMenu={(event) => onEntryContextMenu?.(event, entry)}
          >
            <GridIcon isDirectory={entry.isDirectory} />
            <span className="explorer-icon-grid__name">
              <SearchHighlight text={entry.name} query={query} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
