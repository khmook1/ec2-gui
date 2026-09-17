import type { MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerVolumesNavIcon } from "@/components/icons/NavIcons";
import { useFilteredDockerVolumes } from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerVolume } from "@/types/docker";
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
      className="explorer-icon-grid explorer-icon-grid--docker"
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
          <button
            key={volume.name}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              "explorer-icon-grid__item--docker",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${volume.name}\n${volume.driver}\n${volume.mountpoint}`}
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(volume.name);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenVolume?.(volume);
            }}
            onContextMenu={(event) => onVolumeContextMenu?.(event, volume)}
          >
            <DockerVolumesNavIcon className="docker-grid__icon" />
            <span className="explorer-icon-grid__name docker-grid__name">
              <SearchHighlight text={volume.name} query={query} />
            </span>
            <span className="docker-grid__meta">
              <SearchHighlight text={volume.driver || "—"} query={query} />
            </span>
            <span className="docker-grid__meta docker-grid__meta--status">
              <SearchHighlight text={volume.scope || "—"} query={query} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
