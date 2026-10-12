import { useMemo, type MouseEvent } from "react";
import { FavoriteStarButton } from "@/components/common/FavoriteStarButton";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import {
  shortContainerId,
  useFilteredDockerContainers,
} from "@/lib/useFilteredDockerContainers";
import { useListSelection } from "@/providers/ListSelectionProvider";
import {
  getDockerContainerState,
  isNginxContainer,
  type DockerContainer,
} from "@/types/docker";
import { ContainerStatePill } from "./ContainerStatePill";
import "../css/docker-list.css";

interface ContainerListProps {
  containers: DockerContainer[];
  isFavorite?: (container: DockerContainer) => boolean;
  onToggleFavorite?: (container: DockerContainer) => void;
  onOpenContainer?: (container: DockerContainer) => void;
  onContainerContextMenu?: (
    event: MouseEvent,
    container: DockerContainer | null,
  ) => void;
}

export function ContainerList({
  containers,
  isFavorite,
  onToggleFavorite,
  onOpenContainer,
  onContainerContextMenu,
}: ContainerListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filteredContainers, query, emptyMessage } =
    useFilteredDockerContainers(containers);

  const settings = useMemo<TableColumnSetting<DockerContainer>[]>(
    () => [
      {
        name: "CONTAINER ID",
        width: onToggleFavorite ? 150 : 120,
        className: "table-list__mono",
        render: (container) => (
          <span className="docker-list__id-cell" title={container.id}>
            {onToggleFavorite ? (
              <FavoriteStarButton
                active={isFavorite?.(container) ?? false}
                name={container.names}
                onToggle={() => onToggleFavorite(container)}
              />
            ) : null}
            <SearchHighlight
              text={shortContainerId(container.id)}
              query={query}
            />
          </span>
        ),
      },
      {
        name: "IMAGE",
        render: (container) => (
          <SearchHighlight text={container.image} query={query} />
        ),
      },
      {
        name: "STATUS",
        className: "table-list__cell-muted docker-list__td--status",
        render: (container) => {
          const state = getDockerContainerState(container.status);
          return (
            <span
              className={[
                "docker-list__status",
                state === "restarting" ? "docker-list__status--restarting" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <ContainerStatePill state={state} />
              <SearchHighlight text={container.status} query={query} />
            </span>
          );
        },
      },
      {
        name: "NAMES",
        render: (container) => (
          <span className="docker-list__name-cell">
            {isNginxContainer(container) ? (
              <span className="docker-list__nginx-badge" aria-label="nginx">
                NGINX
              </span>
            ) : null}
            <SearchHighlight text={container.names} query={query} />
          </span>
        ),
      },
      {
        name: "PORTS",
        className: "table-list__cell-muted",
        render: (container) => (
          <SearchHighlight text={container.ports || "—"} query={query} />
        ),
      },
    ],
    [isFavorite, onToggleFavorite, query],
  );

  return (
    <TableList
      list={filteredContainers}
      settings={settings}
      ariaLabel="Docker 컨테이너"
      getRowKey={(container) => container.id}
      emptyMessage={emptyMessage}
      onBackgroundClick={clearSelection}
      onRowClick={(container) => select(container.id)}
      onRowDoubleClick={(container) => onOpenContainer?.(container)}
      onRowContextMenu={(container, _index, event) =>
        onContainerContextMenu?.(event, container)
      }
      getRowClassName={(container) => {
        const state = getDockerContainerState(container.status);
        return (
          [
            selectedKey === container.id ? "table-list__row--selected" : "",
            isNginxContainer(container) ? "table-list__row--nginx" : "",
            state === "restarting" ? "table-list__row--restarting" : "",
            state === "stopped" || state === "unknown"
              ? "table-list__row--stopped"
              : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined
        );
      }}
    />
  );
}
