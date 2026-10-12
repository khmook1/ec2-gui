import type { MouseEvent } from "react";
import { ResourceCard } from "@/components/common/ResourceCard";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerImagesNavIcon } from "@/components/icons/NavIcons";
import {
  shortDockerId,
  useFilteredDockerImages,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerImage } from "@/types/docker";
import "@/components/explorer/css/file-icon-grid.css";
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
      className="explorer-icon-grid explorer-icon-grid--docker resource-card-grid"
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
          <ResourceCard
            key={key}
            tone="docker"
            selected={selected}
            icon={<DockerImagesNavIcon />}
            overline="Docker 이미지"
            name={<SearchHighlight text={image.repository} query={query} />}
            description={
              <SearchHighlight text={`태그 ${image.tag}`} query={query} />
            }
            footer={
              <>
                <span className="resource-card__footer-main">
                  {shortDockerId(image.id)}
                </span>
                <span className="resource-card__footer-end">
                  {image.size || "—"}
                </span>
              </>
            }
            buttonProps={{
              title: `${image.repository}:${image.tag}\n${image.id}\n${image.size}`,
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                select(key);
              },
              onDoubleClick: (event) => {
                event.stopPropagation();
                onOpenImage?.(image);
              },
              onContextMenu: (event) => {
                event.stopPropagation();
                onImageContextMenu?.(event, image);
              },
            }}
          />
        );
      })}
    </div>
  );
}
