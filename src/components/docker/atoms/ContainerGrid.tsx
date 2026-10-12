import type { MouseEvent } from "react";
import { FavoriteStarButton } from "@/components/common/FavoriteStarButton";
import { ResourceCard } from "@/components/common/ResourceCard";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerNavIcon } from "@/components/icons/NavIcons";
import { useFilteredDockerContainers } from "@/lib/useFilteredDockerContainers";
import { shortDockerId } from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import {
  getDockerContainerState,
  isNginxContainer,
  type DockerContainer,
} from "@/types/docker";
import { ContainerStatePill } from "./ContainerStatePill";
import "@/components/explorer/css/file-icon-grid.css";
import "../css/docker-grid.css";

interface ContainerGridProps {
  containers: DockerContainer[];
  isFavorite?: (container: DockerContainer) => boolean;
  onToggleFavorite?: (container: DockerContainer) => void;
  onOpenContainer?: (container: DockerContainer) => void;
  onContainerContextMenu?: (
    event: MouseEvent,
    container: DockerContainer | null,
  ) => void;
}

export function ContainerGrid({
  containers,
  isFavorite,
  onToggleFavorite,
  onOpenContainer,
  onContainerContextMenu,
}: ContainerGridProps) {
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
      className="explorer-icon-grid explorer-icon-grid--docker resource-card-grid"
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
        const restarting = state === "restarting";
        const stopped = state === "stopped" || state === "unknown";
        const nginx = isNginxContainer(container);
        const favorite = isFavorite?.(container) ?? false;

        return (
          <ResourceCard
            key={container.id}
            tone={
              restarting
                ? "restarting"
                : nginx
                  ? "nginx"
                  : state === "paused"
                    ? "paused"
                    : stopped
                      ? "stopped"
                      : "docker"
            }
            selected={selected}
            icon={<DockerNavIcon />}
            overline="Docker 컨테이너"
            name={<SearchHighlight text={container.names} query={query} />}
            description={
              <SearchHighlight text={container.image} query={query} />
            }
            badges={
              <>
                <ContainerStatePill state={state} />
                {nginx ? (
                  <span className="docker-grid__nginx-badge">NGINX</span>
                ) : null}
              </>
            }
            footer={
              <>
                <span className="resource-card__footer-main">
                  <SearchHighlight text={container.status} query={query} />
                </span>
                <span className="resource-card__footer-end">
                  {shortDockerId(container.id)}
                </span>
              </>
            }
            cornerAction={
              onToggleFavorite ? (
                <FavoriteStarButton
                  active={favorite}
                  name={container.names}
                  className="docker-grid__favorite"
                  onToggle={() => onToggleFavorite(container)}
                />
              ) : null
            }
            buttonProps={{
              title: `${container.names}\n${container.image}\n${container.status}`,
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                select(container.id);
              },
              onDoubleClick: (event) => {
                event.stopPropagation();
                onOpenContainer?.(container);
              },
              onContextMenu: (event) => {
                event.stopPropagation();
                onContainerContextMenu?.(event, container);
              },
            }}
          />
        );
      })}
    </div>
  );
}
