import type { MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerNavIcon } from "@/components/icons/NavIcons";
import { useFilteredDockerContainers } from "@/lib/useFilteredDockerContainers";
import { useListSelection } from "@/providers/ListSelectionProvider";
import {
  getDockerContainerState,
  isNginxContainer,
  type DockerContainer,
} from "@/types/docker";

interface DockerContainerGridProps {
  containers: DockerContainer[];
  onOpenContainer?: (container: DockerContainer) => void;
  onContainerContextMenu?: (
    event: MouseEvent,
    container: DockerContainer | null,
  ) => void;
}

export function DockerContainerGrid({
  containers,
  onOpenContainer,
  onContainerContextMenu,
}: DockerContainerGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filteredContainers, query, emptyMessage } =
    useFilteredDockerContainers(containers);

  if (filteredContainers.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
        onContextMenu={(event) => onContainerContextMenu?.(event, null)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="explorer-icon-grid explorer-icon-grid--docker"
      role="list"
      aria-label="Docker 컨테이너 카드 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
      onContextMenu={(event) => onContainerContextMenu?.(event, null)}
    >
      {filteredContainers.map((container) => {
        const selected = selectedKey === container.id;
        const state = getDockerContainerState(container.status);
        const running = state === "running" || state === "paused";
        const nginx = isNginxContainer(container);

        return (
          <button
            key={container.id}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              "explorer-icon-grid__item--docker",
              nginx ? "explorer-icon-grid__item--nginx" : "",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${container.names}\n${container.image}\n${container.status}`}
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(container.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onOpenContainer?.(container);
            }}
            onContextMenu={(event) =>
              onContainerContextMenu?.(event, container)
            }
          >
            {nginx ? (
              <span className="docker-grid__nginx-badge" aria-label="nginx">
                NGINX
              </span>
            ) : null}
            <span
              className={[
                "docker-grid__status-dot",
                running
                  ? "docker-grid__status-dot--running"
                  : "docker-grid__status-dot--stopped",
              ].join(" ")}
              aria-hidden
            />
            <DockerNavIcon className="docker-grid__icon" />
            <span className="explorer-icon-grid__name docker-grid__name">
              <SearchHighlight text={container.names} query={query} />
            </span>
            <span className="docker-grid__meta">
              <SearchHighlight text={container.image} query={query} />
            </span>
            <span className="docker-grid__meta docker-grid__meta--status">
              <SearchHighlight text={container.status} query={query} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
