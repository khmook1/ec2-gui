import type { MouseEvent } from "react";
import { ResourceCard } from "@/components/common/ResourceCard";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerVolumesNavIcon } from "@/components/icons/NavIcons";
import { useFilteredDockerVolumes } from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerVolume } from "@/types/docker";
import "@/components/explorer/css/file-icon-grid.css";
import "../css/docker-grid.css";

interface VolumeGridProps {
  volumes: DockerVolume[];
  onOpenVolume?: (volume: DockerVolume) => void;
  onVolumeContextMenu?: (
    event: MouseEvent,
    volume: DockerVolume | null,
  ) => void;
}

export function VolumeGrid({
  volumes,
  onOpenVolume,
  onVolumeContextMenu,
}: VolumeGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerVolumes(volumes);

  if (filtered.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
        onContextMenu={(event) => onVolumeContextMenu?.(event, null)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="explorer-icon-grid explorer-icon-grid--docker resource-card-grid"
      role="list"
      aria-label="Docker 볼륨 카드 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
      onContextMenu={(event) => onVolumeContextMenu?.(event, null)}
    >
      {filtered.map((volume) => {
        const selected = selectedKey === volume.name;
        return (
          <ResourceCard
            key={volume.name}
            tone="docker"
            selected={selected}
            icon={<DockerVolumesNavIcon />}
            overline="Docker 볼륨"
            name={<SearchHighlight text={volume.name} query={query} />}
            description={
              <SearchHighlight text={volume.mountpoint || "—"} query={query} />
            }
            footer={
              <>
                <span className="resource-card__footer-main">
                  <SearchHighlight text={volume.driver || "—"} query={query} />
                </span>
                <span className="resource-card__footer-end">
                  {volume.scope || "—"}
                </span>
              </>
            }
            buttonProps={{
              title: `${volume.name}\n${volume.driver}\n${volume.mountpoint}`,
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                select(volume.name);
              },
              onDoubleClick: (event) => {
                event.stopPropagation();
                onOpenVolume?.(volume);
              },
              onContextMenu: (event) => {
                event.stopPropagation();
                onVolumeContextMenu?.(event, volume);
              },
            }}
          />
        );
      })}
    </div>
  );
}
