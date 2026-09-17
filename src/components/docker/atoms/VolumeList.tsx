import { useMemo, type MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import { useFilteredDockerVolumes } from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerVolume } from "@/types/docker";
import "../css/docker-list.css";

interface VolumeListProps {
  volumes: DockerVolume[];
  onOpenVolume?: (volume: DockerVolume) => void;
  onVolumeContextMenu?: (
    event: MouseEvent,
    volume: DockerVolume | null,
  ) => void;
}

export function VolumeList({
  volumes,
  onOpenVolume,
  onVolumeContextMenu,
}: VolumeListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerVolumes(volumes);

  const settings = useMemo<TableColumnSetting<DockerVolume>[]>(
    () => [
      {
        name: "NAME",
        render: (volume) => (
          <SearchHighlight text={volume.name} query={query} />
        ),
      },
      {
        name: "DRIVER",
        width: 120,
        render: (volume) => (
          <SearchHighlight text={volume.driver || "—"} query={query} />
        ),
      },
      {
        name: "SCOPE",
        width: 100,
        className: "table-list__cell-muted",
        render: (volume) => (
          <SearchHighlight text={volume.scope || "—"} query={query} />
        ),
      },
      {
        name: "MOUNTPOINT",
        className: "table-list__cell-muted table-list__mono",
        render: (volume) => (
          <SearchHighlight text={volume.mountpoint || "—"} query={query} />
        ),
      },
    ],
    [query],
  );

  return (
    <TableList
      list={filtered}
      settings={settings}
      ariaLabel="Docker 볼륨"
      getRowKey={(volume) => volume.name}
      emptyMessage={emptyMessage}
      onBackgroundClick={clearSelection}
      onRowClick={(volume) => select(volume.name)}
      onRowDoubleClick={(volume) => onOpenVolume?.(volume)}
      onRowContextMenu={(volume, _index, event) =>
        onVolumeContextMenu?.(event, volume)
      }
      getRowClassName={(volume) =>
        selectedKey === volume.name ? "table-list__row--selected" : undefined
      }
    />
  );
}
