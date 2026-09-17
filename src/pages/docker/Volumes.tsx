import { useCallback, useMemo, type MouseEvent } from "react";
import { VolumeGrid } from "@/components/docker/atoms/VolumeGrid";
import { VolumeList } from "@/components/docker/atoms/VolumeList";
import {
  DockerListPageShell,
  useDockerListSelection,
} from "@/components/docker/ListPageShell";
import {
  useDockerVolumeActionMutation,
  useDockerVolumesQuery,
} from "@/hooks/query";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import {
  getDockerActionErrorMessage,
  truncateDockerOutput,
} from "@/lib/dockerActionResult";
import {
  getDockerVolumeDestructiveConfirmMeta,
  type DockerVolumeDestructiveAction,
} from "@/lib/dockerDestructiveConfirm";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import { useToast } from "@/providers/ToastProvider";
import type { DockerVolume, DockerVolumeAction } from "@/types/docker";

const EMPTY_VOLUMES: DockerVolume[] = [];

export function DockerVolumesPage() {
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const [selectedId, setSelectedId] = useDockerListSelection();
  const volumesQuery = useDockerVolumesQuery();
  const volumeAction = useDockerVolumeActionMutation();
  const items = volumesQuery.data ?? EMPTY_VOLUMES;
  const hasCache =
    volumesQuery.isSuccess ||
    (volumesQuery.isFetching && volumesQuery.data != null);
  const isFetching = volumesQuery.isFetching;
  const isActing = volumeAction.isPending;
  const errorMessage =
    volumesQuery.error instanceof Error
      ? volumesQuery.error.message
      : volumesQuery.isError
        ? "Docker 볼륨 목록을 불러오지 못했습니다."
        : null;
  const refresh = useCallback(() => {
    void volumesQuery.refetch();
  }, [volumesQuery]);

  const busy = isFetching || isActing || isConfirming;

  const selectedVolume = useMemo(
    () => items.find((volume) => volume.name === selectedId) ?? null,
    [items, selectedId],
  );

  const runVolumeAction = useCallback(
    async (volumeName: string, action: DockerVolumeAction) => {
      try {
        const output = await volumeAction.mutateAsync({ volumeName, action });
        const trimmed = truncateDockerOutput(output);
        if (trimmed) {
          toast.success(trimmed, { mono: action === "inspect" });
        } else {
          toast.success("명령을 실행했습니다.");
        }
        return output;
      } catch (error) {
        toast.error(
          getDockerActionErrorMessage(
            error,
            "Docker 볼륨 명령을 실행하지 못했습니다.",
          ),
        );
        throw error;
      }
    },
    [toast, volumeAction],
  );

  const requestDestructiveVolumeAction = useCallback(
    (
      target: { id: string; label: string },
      action: DockerVolumeDestructiveAction,
    ) => {
      const meta = getDockerVolumeDestructiveConfirmMeta(action);
      requestConfirm({
        targetId: target.id,
        label: target.label,
        ...meta,
        onConfirm: async () => {
          await runVolumeAction(action === "prune" ? "" : target.id, action);
          if (action === "remove" || action === "force-remove") {
            setSelectedId((current) =>
              current === target.id ? null : current,
            );
          }
        },
      });
    },
    [requestConfirm, runVolumeAction, setSelectedId],
  );

  const requestPrune = useCallback(() => {
    requestDestructiveVolumeAction(
      { id: "unused-volumes", label: "미사용 볼륨" },
      "prune",
    );
  }, [requestDestructiveVolumeAction]);

  const buildMenuItems = useCallback(
    (volume: DockerVolume | null): ContextMenuItem[] => {
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

      if (!volume) {
        return items;
      }

      items.push(
        {
          id: "inspect",
          label: "상세 정보 (inspect)",
          separatorBefore: true,
          disabled: busy,
          onSelect: () => {
            void runVolumeAction(volume.name, "inspect");
          },
        },
        {
          id: "remove",
          label: "삭제 (rm)",
          separatorBefore: true,
          danger: true,
          disabled: busy,
          onSelect: () => {
            requestDestructiveVolumeAction(
              { id: volume.name, label: volume.name },
              "remove",
            );
          },
        },
        {
          id: "force-remove",
          label: "강제 삭제 (rm -f)",
          danger: true,
          disabled: busy,
          onSelect: () => {
            requestDestructiveVolumeAction(
              { id: volume.name, label: volume.name },
              "force-remove",
            );
          },
        },
      );

      return items;
    },
    [busy, refresh, requestDestructiveVolumeAction, runVolumeAction],
  );

  const openContext = useCallback(
    (event: MouseEvent, volume: DockerVolume | null) => {
      event.preventDefault();
      event.stopPropagation();
      if (volume) {
        setSelectedId(volume.name);
      }
      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(volume),
      });
    },
    [buildMenuItems, openContextMenu, setSelectedId],
  );

  return (
    <DockerListPageShell
      titleHint="Docker 볼륨 목록"
      statusLabel={(count) => `${count}개 볼륨`}
      items={items}
      hasCache={hasCache}
      isFetching={isFetching}
      isActing={isActing || isConfirming}
      errorMessage={errorMessage}
      refresh={refresh}
      onPrune={requestPrune}
      pruneTooltip="미사용 볼륨 정리"
      selectedKey={selectedId}
      onSelectedKeyChange={setSelectedId}
      selectedLabel={selectedVolume?.name ?? null}
      buildMenuItems={(hasSelection) =>
        buildMenuItems(hasSelection ? selectedVolume : null)
      }
      tableList={
        <VolumeList volumes={items} onVolumeContextMenu={openContext} />
      }
      gui={
        <VolumeGrid volumes={items} onVolumeContextMenu={openContext} />
      }
    >
      {confirmDialog}
    </DockerListPageShell>
  );
}
