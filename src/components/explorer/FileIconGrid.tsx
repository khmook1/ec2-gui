import type { MouseEvent } from "react";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { FavoriteStarButton } from "@/components/common/FavoriteStarButton";
import { useFilteredRemoteEntries } from "@/lib/useFilteredRemoteEntries";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { RemoteEntry } from "@/types/filesystem";
import {
  getEntryKindLabel,
  getExplorerFileIconKind,
  getParentPath,
  type ExplorerFileIconKind,
} from "@/utils/file";
import "./css/file-icon-grid.css";

interface FileIconGridProps {
  entries: RemoteEntry[];
  isLoading: boolean;
  isLetterFocused?: (entry: RemoteEntry) => boolean;
  isFavorite?: (path: string) => boolean;
  isShortcut?: (entry: RemoteEntry) => boolean;
  onToggleFavorite?: (entry: RemoteEntry) => void;
  onOpenEntry: (entry: RemoteEntry) => void;
  onEntryContextMenu?: (event: MouseEvent, entry: RemoteEntry | null) => void;
}

function GridIcon({
  kind,
  shortcut,
}: {
  kind: ExplorerFileIconKind;
  shortcut: boolean;
}) {
  return (
    <span className="explorer-icon-wrap">
      <span
        className={`explorer-icon explorer-icon--grid explorer-icon--${kind}`}
        aria-hidden
      />
      {shortcut ? (
        <span
          className="explorer-shortcut-badge explorer-shortcut-badge--grid"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export function FileIconGrid({
  entries,
  isLoading,
  isLetterFocused,
  isFavorite,
  isShortcut,
  onToggleFavorite,
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
        "explorer-icon-grid--files",
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
        const letterFocused = isLetterFocused?.(entry) ?? false;
        const favorite = isFavorite?.(entry.path) ?? false;
        const shortcut = isShortcut?.(entry) ?? false;

        return (
          <div
            key={entry.path}
            role="listitem"
            className="explorer-icon-grid__cell"
          >
            <button
              type="button"
              className={[
                "explorer-icon-grid__item",
                selected ? "explorer-icon-grid__item--selected" : "",
                letterFocused ? "explorer-icon-grid__item--letter-focus" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={isLoading}
              title={shortcut ? entry.path : entry.name}
              aria-label={`${shortcut ? "바로가기 " : favorite ? "즐겨찾기 " : ""}${entry.name} ${getEntryKindLabel(entry.isDirectory, entry.name)}`}
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
              <GridIcon
                kind={getExplorerFileIconKind(entry.isDirectory, entry.name)}
                shortcut={shortcut}
              />
              <span className="explorer-icon-grid__name">
                <SearchHighlight text={entry.name} query={query} />
              </span>
              {shortcut ? (
                <span className="explorer-icon-grid__location">
                  {getParentPath(entry.path)}
                </span>
              ) : null}
            </button>
            {onToggleFavorite ? (
              <FavoriteStarButton
                active={favorite}
                name={entry.name}
                className="explorer-icon-grid__favorite"
                onToggle={() => onToggleFavorite(entry)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
