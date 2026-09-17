import type { MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerImagesNavIcon } from "@/components/icons/NavIcons";
import {
  shortDockerId,
  useFilteredDockerImages,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerImage } from "@/types/docker";
import "../css/docker-grid.css";

interface ImageGridProps {
  images: DockerImage[];
  onOpenImage?: (image: DockerImage) => void;
  onImageContextMenu?: (event: MouseEvent, image: DockerImage | null) => void;
}

function imageKey(image: DockerImage): string {
  return `${image.id}:${image.repository}:${image.tag}`;
}

export function ImageGrid({
  images,
  onOpenImage,
  onImageContextMenu,
}: ImageGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerImages(images);

  if (filtered.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
        onContextMenu={(event) => onImageContextMenu?.(event, null)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="explorer-icon-grid explorer-icon-grid--docker"
      role="list"
      aria-label="Docker 이미지 카드 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
      onContextMenu={(event) => onImageContextMenu?.(event, null)}
    >
      {filtered.map((image) => {
        const key = imageKey(image);
        const selected = selectedKey === key;
        return (
          <button
            key={key}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              "explorer-icon-grid__item--docker",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${image.repository}:${image.tag}\n${image.id}\n${image.size}`}
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(key);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenImage?.(image);
            }}
            onContextMenu={(event) => onImageContextMenu?.(event, image)}
          >
            <DockerImagesNavIcon className="docker-grid__icon" />
            <span className="explorer-icon-grid__name docker-grid__name">
              <SearchHighlight text={image.repository} query={query} />
            </span>
            <span className="docker-grid__meta">
              <SearchHighlight text={image.tag} query={query} />
            </span>
            <span className="docker-grid__meta docker-grid__meta--status">
              <SearchHighlight
                text={`${shortDockerId(image.id)} · ${image.size || "—"}`}
                query={query}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
