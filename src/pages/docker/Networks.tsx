import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { NetworkDetailsDialog } from "@/components/docker/dialogs/NetworkDetailsDialog";
import { NetworkGrid } from "@/components/docker/atoms/NetworkGrid";
import { NetworkList } from "@/components/docker/atoms/NetworkList";
import {
  DockerListPageShell,
  useDockerListSelection,
} from "@/components/docker/ListPageShell";
import {
  useDockerNetworkActionMutation,
  useDockerNetworksQuery,
} from "@/hooks/query";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import {
  getDockerActionErrorMessage,
  truncateDockerOutput,
} from "@/lib/dockerActionResult";
import {
  getDockerNetworkDestructiveConfirmMeta,
  type DockerNetworkDestructiveAction,
} from "@/lib/dockerDestructiveConfirm";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  isBuiltinDockerNetwork,
  type DockerNetwork,
  type DockerNetworkAction,
} from "@/types/docker";

const EMPTY_NETWORKS: DockerNetwork[] = [];

export function DockerNetworksPage() {
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const [selectedId, setSelectedId] = useDockerListSelection();
  const [detailsNetwork, setDetailsNetwork] = useState<DockerNetwork | null>(
    null,
  );
  const networksQuery = useDockerNetworksQuery();
  const networkAction = useDockerNetworkActionMutation();
  const items = networksQuery.data ?? EMPTY_NETWORKS;
  const hasCache =
    networksQuery.isSuccess ||
    (networksQuery.isFetching && networksQuery.data != null);
  const isFetching = networksQuery.isFetching;
  const isActing = networkAction.isPending;
  const errorMessage =
    networksQuery.error instanceof Error
      ? networksQuery.error.message
      : networksQuery.isError
        ? "Docker 네트워크 목록을 불러오지 못했습니다."
        : null;
  const refresh = useCallback(() => {
    void networksQuery.refetch();
  }, [networksQuery]);

  const busy = isFetching || isActing || isConfirming;

  const selectedNetwork = useMemo(
    () => items.find((network) => network.id === selectedId) ?? null,
    [items, selectedId],
  );

  const openNetworkDetails = useCallback(
    (network: DockerNetwork) => {
      setSelectedId(network.id);
      setDetailsNetwork(network);
    },
    [setSelectedId],
  );

  const runNetworkAction = useCallback(
    async (networkRef: string, action: DockerNetworkAction) => {
      try {
        const output = await networkAction.mutateAsync({ networkRef, action });
        if (action === "inspect") {
          return output;
        }
        const trimmed = truncateDockerOutput(output);
        if (trimmed) {
          toast.success(trimmed);
        } else {
          toast.success("명령을 실행했습니다.");
        }
        return output;
      } catch (error) {
        toast.error(
          getDockerActionErrorMessage(
            error,
            "Docker 네트워크 명령을 실행하지 못했습니다.",
          ),
        );
        throw error;
      }
    },
    [networkAction, toast],
  );

  const requestDestructiveNetworkAction = useCallback(
    (
      target: { id: string; label: string; ref: string },
      action: DockerNetworkDestructiveAction,
    ) => {
      const meta = getDockerNetworkDestructiveConfirmMeta(action);
      requestConfirm({
        targetId: target.id,
        label: target.label,
        ...meta,
        onConfirm: async () => {
          await runNetworkAction(action === "prune" ? "" : target.ref, action);
          if (action === "remove" || action === "force-remove") {
            setSelectedId((current) =>
              current === target.id ? null : current,
            );
            setDetailsNetwork((current) =>
              current?.id === target.id ? null : current,
            );
          }
        },
      });
    },
    [requestConfirm, runNetworkAction, setSelectedId],
  );

  const requestPrune = useCallback(() => {
    requestDestructiveNetworkAction(
      {
        id: "unused-networks",
        label: "미사용 네트워크",
        ref: "",
      },
      "prune",
    );
  }, [requestDestructiveNetworkAction]);

  const buildMenuItems = useCallback(
    (network: DockerNetwork | null): ContextMenuItem[] => {
      const items: ContextMenuItem[] = [
        {
          id: "refresh",
          label: "목록 새로고침",
          disabled: busy,
          onSelect: () => {
            void refresh();
          },
        },
      ];

      if (!network) {
        return items;
      }

      const builtin = isBuiltinDockerNetwork(network);
      const networkRef = network.name || network.id;

      items.push(
        {
          id: "details",
          label: "상세 정보",
          separatorBefore: true,
          onSelect: () => {
            openNetworkDetails(network);
          },
        },
        {
          id: "remove",
          label: "삭제 (rm)",
          separatorBefore: true,
          danger: true,
          disabled: busy || builtin,
          onSelect: () => {
            requestDestructiveNetworkAction(
              {
                id: network.id,
                label: network.name,
                ref: networkRef,
              },
              "remove",
            );
          },
        },
        {
          id: "force-remove",
          label: "강제 삭제 (rm -f)",
          danger: true,
          disabled: busy || builtin,
          onSelect: () => {
            requestDestructiveNetworkAction(
              {
                id: network.id,
                label: network.name,
                ref: networkRef,
              },
              "force-remove",
            );
          },
        },
      );

      return items;
    },
    [busy, openNetworkDetails, refresh, requestDestructiveNetworkAction],
  );

  const openContext = useCallback(
    (event: MouseEvent, network: DockerNetwork | null) => {
      event.preventDefault();
      event.stopPropagation();
      if (network) {
        setSelectedId(network.id);
      }
      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(network),
      });
    },
    [buildMenuItems, openContextMenu, setSelectedId],
  );

  return (
    <DockerListPageShell
      titleHint="Docker 네트워크 목록"
      statusLabel={(count) => `${count}개 네트워크`}
      items={items}
      hasCache={hasCache}
      isFetching={isFetching}
      isActing={isActing || isConfirming}
      errorMessage={errorMessage}
      refresh={refresh}
      onPrune={requestPrune}
      pruneTooltip="미사용 네트워크 정리"
      selectedKey={selectedId}
      onSelectedKeyChange={setSelectedId}
      selectedLabel={selectedNetwork?.name ?? null}
      buildMenuItems={(hasSelection) =>
        buildMenuItems(hasSelection ? selectedNetwork : null)
      }
      tableList={
        <NetworkList
          networks={items}
          onOpenNetwork={openNetworkDetails}
          onNetworkContextMenu={openContext}
        />
      }
      gui={
        <NetworkGrid
          networks={items}
          onOpenNetwork={openNetworkDetails}
          onNetworkContextMenu={openContext}
        />
      }
    >
      <NetworkDetailsDialog
        key={detailsNetwork?.id ?? "network-details-closed"}
        network={detailsNetwork}
        isActing={busy}
        onClose={() => setDetailsNetwork(null)}
        onRequestDestructive={requestDestructiveNetworkAction}
      />
      {confirmDialog}
    </DockerListPageShell>
  );
}
