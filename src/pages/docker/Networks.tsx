import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { NetworkGrid } from "@/components/docker/atoms/NetworkGrid";
import { NetworkList } from "@/components/docker/atoms/NetworkList";
import {
  DockerListPageShell,
  useDockerListSelection,
} from "@/components/docker/ListPageShell";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { useDockerResourceList } from "@/hooks/useDockerResourceList";
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
  listRemoteDockerNetworks,
  runRemoteDockerNetworkAction,
} from "@/services/tauri";
import {
  isBuiltinDockerNetwork,
  type DockerNetwork,
  type DockerNetworkAction,
} from "@/types/docker";

export function DockerNetworksPage() {
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const [selectedId, setSelectedId] = useDockerListSelection();
  const [isActing, setIsActing] = useState(false);
  const { items, hasCache, isFetching, errorMessage, refresh } =
    useDockerResourceList({
      fetcher: listRemoteDockerNetworks,
      errorFallback: "Docker 네트워크 목록을 불러오지 못했습니다.",
    });

  const busy = isFetching || isActing || isConfirming;

  const selectedNetwork = useMemo(
    () => items.find((network) => network.id === selectedId) ?? null,
    [items, selectedId],
  );

  const runNetworkAction = useCallback(
    async (networkRef: string, action: DockerNetworkAction) => {
      setIsActing(true);
      try {
        const output = await runRemoteDockerNetworkAction(networkRef, action);
        const trimmed = truncateDockerOutput(output);
        if (trimmed) {
          toast.success(trimmed, { mono: action === "inspect" });
        } else {
          toast.success("명령을 실행했습니다.");
        }
        if (action !== "inspect") {
          await refresh();
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
      } finally {
        setIsActing(false);
      }
    },
    [refresh, toast],
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
          id: "inspect",
          label: "상세 정보 (inspect)",
          separatorBefore: true,
          disabled: busy,
          onSelect: () => {
            void runNetworkAction(networkRef, "inspect");
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
    [busy, refresh, requestDestructiveNetworkAction, runNetworkAction],
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
          onNetworkContextMenu={openContext}
        />
      }
      gui={
        <NetworkGrid
          networks={items}
          onNetworkContextMenu={openContext}
        />
      }
    >
      {confirmDialog}
    </DockerListPageShell>
  );
}
