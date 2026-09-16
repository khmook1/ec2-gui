import { useMemo, type MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
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
} from "@/utils/file";

interface FileListProps {
  entries: RemoteEntry[];
  isLoading: boolean;
  onOpenEntry: (entry: RemoteEntry) => void;
  onEntryContextMenu?: (event: MouseEvent, entry: RemoteEntry | null) => void;
}

function FileIcon({ isDirectory }: { isDirectory: boolean }) {
  return (
    <span
      className={
        isDirectory
          ? "explorer-icon explorer-icon--folder"
          : "explorer-icon explorer-icon--file"
      }
      aria-hidden
    />
  );
}

export function FileList({
  entries,
  isLoading,
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
        render: (entry) => (
          <span className="table-list__name-cell">
            <FileIcon isDirectory={entry.isDirectory} />
            <span className="table-list__name-text">
              <SearchHighlight text={entry.name} query={query} />
            </span>
          </span>
        ),
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
            text={getEntryKindLabel(entry.isDirectory)}
            query={query}
          />
        ),
      },
    ],
    [query],
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
      getRowClassName={(entry) =>
        selectedKey === entry.path ? "table-list__row--selected" : undefined
      }
    />
  );
}
