import { useMemo, type MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import {
  shortDockerId,
  useFilteredDockerImages,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerImage } from "@/types/docker";
import "../css/docker-list.css";

interface ImageListProps {
  images: DockerImage[];
  onOpenImage?: (image: DockerImage) => void;
  onImageContextMenu?: (event: MouseEvent, image: DockerImage | null) => void;
}

export function ImageList({
  images,
  onOpenImage,
  onImageContextMenu,
}: ImageListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerImages(images);

  const settings = useMemo<TableColumnSetting<DockerImage>[]>(
    () => [
      {
        name: "REPOSITORY",
        render: (image) => (
          <SearchHighlight text={image.repository} query={query} />
        ),
      },
      {
        name: "TAG",
        width: 120,
        render: (image) => (
          <SearchHighlight text={image.tag} query={query} />
        ),
      },
      {
        name: "IMAGE ID",
        width: 120,
        className: "table-list__mono",
        render: (image) => (
          <span title={image.id}>
            <SearchHighlight text={shortDockerId(image.id)} query={query} />
          </span>
        ),
      },
      {
        name: "CREATED",
        className: "table-list__cell-muted",
        render: (image) => (
          <SearchHighlight text={image.createdSince || "—"} query={query} />
        ),
      },
      {
        name: "SIZE",
        width: 100,
        className: "table-list__cell-muted",
        render: (image) => (
          <SearchHighlight text={image.size || "—"} query={query} />
        ),
      },
    ],
    [query],
  );

  return (
    <TableList
      list={filtered}
      settings={settings}
      ariaLabel="Docker 이미지"
      getRowKey={(image) => `${image.id}:${image.repository}:${image.tag}`}
      emptyMessage={emptyMessage}
      onBackgroundClick={clearSelection}
      onRowClick={(image) =>
        select(`${image.id}:${image.repository}:${image.tag}`)
      }
      onRowDoubleClick={(image) => onOpenImage?.(image)}
      onRowContextMenu={(image, _index, event) =>
        onImageContextMenu?.(event, image)
      }
      getRowClassName={(image) =>
        selectedKey === `${image.id}:${image.repository}:${image.tag}`
          ? "table-list__row--selected"
          : undefined
      }
    />
  );
}
