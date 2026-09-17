import type { MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerNetworksNavIcon } from "@/components/icons/NavIcons";
import {
  shortDockerId,
  useFilteredDockerNetworks,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerNetwork } from "@/types/docker";
import "../css/docker-grid.css";

interface NetworkGridProps {
  networks: DockerNetwork[];
  onNetworkContextMenu?: (
    event: MouseEvent,
    network: DockerNetwork | null,
  ) => void;
}

export function NetworkGrid({
  networks,
  onNetworkContextMenu,
}: NetworkGridProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerNetworks(networks);

  if (filtered.length === 0) {
    return (
      <div
        className="explorer-icon-grid explorer-icon-grid--empty"
        role="status"
        onMouseDown={() => clearSelection()}
        onContextMenu={(event) => onNetworkContextMenu?.(event, null)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="explorer-icon-grid explorer-icon-grid--docker"
      role="list"
      aria-label="Docker 네트워크 카드 목록"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearSelection();
        }
      }}
      onContextMenu={(event) => onNetworkContextMenu?.(event, null)}
    >
      {filtered.map((network) => {
        const selected = selectedKey === network.id;
        return (
          <button
            key={network.id}
            type="button"
            role="listitem"
            className={[
              "explorer-icon-grid__item",
              "explorer-icon-grid__item--docker",
              selected ? "explorer-icon-grid__item--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${network.name}\n${network.driver}\n${network.id}`}
            aria-pressed={selected}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              select(network.id);
            }}
            onContextMenu={(event) => onNetworkContextMenu?.(event, network)}
          >
            <DockerNetworksNavIcon className="docker-grid__icon" />
            <span className="explorer-icon-grid__name docker-grid__name">
              <SearchHighlight text={network.name} query={query} />
            </span>
            <span className="docker-grid__meta">
              <SearchHighlight text={network.driver || "—"} query={query} />
            </span>
            <span className="docker-grid__meta docker-grid__meta--status">
              <SearchHighlight
                text={`${shortDockerId(network.id)} · ${network.scope || "—"}`}
                query={query}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
