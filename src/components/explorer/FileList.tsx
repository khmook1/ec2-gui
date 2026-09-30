import { useMemo, type MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { FavoriteStarButton } from "@/components/common/FavoriteStarButton";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import { useFilteredRemoteEntries } from "@/lib/useFilteredRemoteEntries";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { RemoteEntry } from "@/types/filesystem";
import {
  formatFileSize,
  formatModifiedTime,
  getEntryKindLabel,
  getExplorerFileIconKind,
  getParentPath,
  type ExplorerFileIconKind,
} from "@/utils/file";
import "./css/file-list.css";

interface FileListProps {
  entries: RemoteEntry[];
  isLoading: boolean;
  isLetterFocused?: (entry: RemoteEntry) => boolean;
  isFavorite?: (path: string) => boolean;
  isShortcut?: (entry: RemoteEntry) => boolean;
  onToggleFavorite?: (entry: RemoteEntry) => void;
  onOpenEntry: (entry: RemoteEntry) => void;
  onEntryContextMenu?: (event: MouseEvent, entry: RemoteEntry | null) => void;
}

function FileIcon({
  kind,
  shortcut,
}: {
  kind: ExplorerFileIconKind;
  shortcut: boolean;
}) {
  return (
    <span className="explorer-icon-wrap">
      <span className={`explorer-icon explorer-icon--${kind}`} aria-hidden />
      {shortcut ? <span className="explorer-shortcut-badge" aria-hidden /> : null}
    </span>
  );
}

export function FileList({
  entries,
  isLoading,
  isLetterFocused,
  isFavorite,
  isShortcut,
  onToggleFavorite,
  onOpenEntry,
  onEntryContextMenu,
}: FileListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filteredEntries, query, emptyMessage } =
    useFilteredRemoteEntries(entries);

  const settings = useMemo<TableColumnSetting<RemoteEntry>[]>(
    () => [
      {
        name: "이름",
        colProp: { align: "left" },
        render: (entry) => {
          const shortcut = isShortcut?.(entry) ?? false;
          return (
            <span
              className="table-list__name-cell"
              title={shortcut ? entry.path : undefined}
            >
              {onToggleFavorite ? (
                <FavoriteStarButton
                  active={isFavorite?.(entry.path) ?? false}
                  name={entry.name}
                  onToggle={() => onToggleFavorite(entry)}
                />
              ) : null}
              <FileIcon
                kind={getExplorerFileIconKind(entry.isDirectory, entry.name)}
                shortcut={shortcut}
              />
              <span className="table-list__name-text">
                <SearchHighlight text={entry.name} query={query} />
              </span>
              {shortcut ? (
                <span className="explorer-shortcut-location">
                  {getParentPath(entry.path)}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        name: "수정일",
        width: 160,
        className: "table-list__cell-muted",
        colProp: { align: "left" },
        render: (entry) => (
          <SearchHighlight
            text={formatModifiedTime(entry.modifiedAt)}
            query={query}
          />
        ),
      },
      {
        name: "크기",
        width: 90,
        className: "table-list__cell-muted",
        colProp: { align: "right" },
        render: (entry) => (
          <SearchHighlight
            text={entry.isDirectory ? "—" : formatFileSize(entry.size)}
            query={query}
          />
        ),
      },
      {
        name: "종류",
        width: 80,
        className: "table-list__cell-muted",
        colProp: { align: "left" },
        render: (entry) => (
          <SearchHighlight
            text={getEntryKindLabel(entry.isDirectory, entry.name)}
            query={query}
          />
        ),
      },
    ],
    [isFavorite, isShortcut, onToggleFavorite, query],
  );

  return (
    <TableList
      list={filteredEntries}
      settings={settings}
      isLoading={isLoading}
      ariaLabel="파일 목록"
      getRowKey={(entry) => entry.path}
      emptyMessage={emptyMessage}
      loadingMessage="폴더 내용을 불러오는 중..."
      onBackgroundClick={clearSelection}
      onRowClick={(entry) => select(entry.path)}
      onRowDoubleClick={(entry) => void onOpenEntry(entry)}
      onRowContextMenu={(entry, _index, event) =>
        onEntryContextMenu?.(event, entry)
      }
      getRowClassName={(entry) => {
        const classes: string[] = [];
        if (selectedKey === entry.path) {
          classes.push("table-list__row--selected");
        }
        if (isLetterFocused?.(entry)) {
          classes.push("table-list__row--letter-focus");
        }
        return classes.length > 0 ? classes.join(" ") : undefined;
      }}
    />
  );
}
