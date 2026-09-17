import { useMemo, type MouseEvent } from "react";
import { SearchHighlight } from "@/components/common/SearchHighlight";
import {
  TableList,
  type TableColumnSetting,
} from "@/components/common/TableList";
import {
  shortDockerId,
  useFilteredDockerNetworks,
} from "@/lib/useFilteredDockerResources";
import { useListSelection } from "@/providers/ListSelectionProvider";
import type { DockerNetwork } from "@/types/docker";
import "../css/docker-list.css";

interface NetworkListProps {
  networks: DockerNetwork[];
  onOpenNetwork?: (network: DockerNetwork) => void;
  onNetworkContextMenu?: (
    event: MouseEvent,
    network: DockerNetwork | null,
  ) => void;
}

export function NetworkList({
  networks,
  onOpenNetwork,
  onNetworkContextMenu,
}: NetworkListProps) {
  const { selectedKey, select, clearSelection } = useListSelection();
  const { filtered, query, emptyMessage } = useFilteredDockerNetworks(networks);

  const settings = useMemo<TableColumnSetting<DockerNetwork>[]>(
    () => [
      {
        name: "NETWORK ID",
        width: 120,
        className: "table-list__mono",
        render: (network) => (
          <span title={network.id}>
            <SearchHighlight text={shortDockerId(network.id)} query={query} />
          </span>
        ),
      },
      {
        name: "NAME",
        render: (network) => (
          <SearchHighlight text={network.name} query={query} />
        ),
      },
      {
        name: "DRIVER",
        width: 120,
        render: (network) => (
          <SearchHighlight text={network.driver || "—"} query={query} />
        ),
      },
      {
        name: "SCOPE",
        width: 100,
        className: "table-list__cell-muted",
        render: (network) => (
          <SearchHighlight text={network.scope || "—"} query={query} />
        ),
      },
    ],
    [query],
  );

  return (
    <TableList
      list={filtered}
      settings={settings}
      ariaLabel="Docker 네트워크"
      getRowKey={(network) => network.id}
      emptyMessage={emptyMessage}
      onBackgroundClick={clearSelection}
      onRowClick={(network) => select(network.id)}
      onRowDoubleClick={(network) => onOpenNetwork?.(network)}
      onRowContextMenu={(network, _index, event) =>
        onNetworkContextMenu?.(event, network)
      }
      getRowClassName={(network) =>
        selectedKey === network.id ? "table-list__row--selected" : undefined
      }
    />
  );
}
