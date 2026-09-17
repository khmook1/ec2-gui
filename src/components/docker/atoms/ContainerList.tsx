import { useMemo, type MouseEvent } from "react";
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
import { isNginxContainer, type DockerContainer } from "@/types/docker";
import "../css/docker-list.css";

interface ContainerListProps {
  containers: DockerContainer[];
  onOpenContainer?: (container: DockerContainer) => void;
  onContainerContextMenu?: (
    event: MouseEvent,
    container: DockerContainer | null,
  ) => void;
}

export function ContainerList({
  containers,
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
        width: 120,
        className: "table-list__mono",
        render: (container) => (
          <span title={container.id}>
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
        className: "table-list__cell-muted",
        render: (container) => (
          <SearchHighlight text={container.status} query={query} />
        ),
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
    [query],
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
      getRowClassName={(container) =>
        [
          selectedKey === container.id ? "table-list__row--selected" : "",
          isNginxContainer(container) ? "table-list__row--nginx" : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
    />
  );
}
