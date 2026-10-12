import type { MouseEvent } from "react";
import { ResourceCard } from "@/components/common/ResourceCard";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import { DockerNetworksNavIcon } from "@/components/icons/NavIcons";
import {
  shortDockerId,
  useFilteredDockerNetworks,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerNetwork } from "@/types/docker";
import "@/components/explorer/css/file-icon-grid.css";
import "../css/docker-grid.css";

interface NetworkGridProps {
  networks: DockerNetwork[];
  onOpenNetwork?: (network: DockerNetwork) => void;
  onNetworkContextMenu?: (
    event: MouseEvent,
    network: DockerNetwork | null,
  ) => void;
}

export function NetworkGrid({
  networks,
  onOpenNetwork,
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
      className="explorer-icon-grid explorer-icon-grid--docker resource-card-grid"
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
          <ResourceCard
            key={network.id}
            tone="docker"
            selected={selected}
            icon={<DockerNetworksNavIcon />}
            overline="Docker 네트워크"
            name={<SearchHighlight text={network.name} query={query} />}
            description={
              <SearchHighlight
                text={`드라이버 ${network.driver || "—"}`}
                query={query}
              />
            }
            footer={
              <>
                <span className="resource-card__footer-main">
                  {network.scope || "—"}
                </span>
                <span className="resource-card__footer-end">
                  {shortDockerId(network.id)}
                </span>
              </>
            }
            buttonProps={{
              title: `${network.name}\n${network.driver}\n${network.id}`,
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                select(network.id);
              },
              onDoubleClick: (event) => {
                event.stopPropagation();
                onOpenNetwork?.(network);
              },
              onContextMenu: (event) => {
                event.stopPropagation();
                onNetworkContextMenu?.(event, network);
              },
            }}
          />
        );
      })}
    </div>
  );
}
