import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { ImageGrid } from "@/components/docker/atoms/ImageGrid";
import { ImageList } from "@/components/docker/atoms/ImageList";
import {
  DockerListPageShell,
  useDockerListSelection,
} from "@/components/docker/ListPageShell";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { useDockerResourceList } from "@/hooks/useDockerResourceList";
import {
  getDockerImageDestructiveConfirmMeta,
  type DockerImageDestructiveAction,
} from "@/lib/dockerDestructiveConfirm";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  listRemoteDockerImages,
  runRemoteDockerImageAction,
} from "@/services/tauri";
import {
  canPullDockerImage,
  getDockerImageRef,
  type DockerImage,
  type DockerImageAction,
} from "@/types/docker";

const TOAST_OUTPUT_LIMIT = 4000;

function imageKey(image: DockerImage): string {
  return `${image.id}:${image.repository}:${image.tag}`;
}

function imageLabel(image: DockerImage): string {
  return getDockerImageRef(image);
}

function truncateOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= TOAST_OUTPUT_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, TOAST_OUTPUT_LIMIT)}\n…(출력이 잘렸습니다)`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Docker 이미지 명령을 실행하지 못했습니다.";
}

export function DockerImagesPage() {
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const [selectedId, setSelectedId] = useDockerListSelection();
  const [isActing, setIsActing] = useState(false);
  const { items, hasCache, isFetching, errorMessage, refresh } =
    useDockerResourceList({
      fetcher: listRemoteDockerImages,
      errorFallback: "Docker 이미지 목록을 불러오지 못했습니다.",
    });

  const busy = isFetching || isActing || isConfirming;

  const selectedImage = useMemo(
    () => items.find((image) => imageKey(image) === selectedId) ?? null,
    [items, selectedId],
  );

  const runImageAction = useCallback(
    async (imageRef: string, action: DockerImageAction) => {
      setIsActing(true);
      try {
        const output = await runRemoteDockerImageAction(imageRef, action);
        const trimmed = truncateOutput(output);
        if (trimmed) {
          toast.success(trimmed, {
            mono:
              action === "inspect" || action === "history" || action === "pull",
          });
        } else {
          toast.success("명령을 실행했습니다.");
        }
        if (action !== "inspect" && action !== "history") {
          await refresh();
        }
        return output;
      } catch (error) {
        toast.error(getErrorMessage(error));
        throw error;
      } finally {
        setIsActing(false);
      }
    },
    [refresh, toast],
  );

  const requestDestructiveImageAction = useCallback(
    (
      target: { id: string; label: string },
      action: DockerImageDestructiveAction,
    ) => {
      const meta = getDockerImageDestructiveConfirmMeta(action);
      requestConfirm({
        targetId: target.id,
        label: target.label,
        ...meta,
        onConfirm: async () => {
          await runImageAction(action === "prune" ? "" : target.id, action);
          if (action === "remove" || action === "force-remove") {
            setSelectedId((current) =>
              current?.startsWith(`${target.id}:`) ? null : current,
            );
          }
        },
      });
    },
    [requestConfirm, runImageAction, setSelectedId],
  );

  const requestPrune = useCallback(() => {
    requestDestructiveImageAction(
      { id: "dangling-images", label: "미사용(dangling) 이미지" },
      "prune",
    );
  }, [requestDestructiveImageAction]);

  const buildMenuItems = useCallback(
    (image: DockerImage | null): ContextMenuItem[] => {
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

      if (!image) {
        return items;
      }

      const pullable = canPullDockerImage(image);
      const namedRef = imageLabel(image);

      items.push(
        {
          id: "inspect",
          label: "상세 정보 (inspect)",
          separatorBefore: true,
          disabled: busy,
          onSelect: () => {
            void runImageAction(image.id, "inspect");
          },
        },
        {
          id: "history",
          label: "히스토리 (history)",
          disabled: busy,
          onSelect: () => {
            void runImageAction(image.id, "history");
          },
        },
        {
          id: "pull",
          label: "다시 받기 (pull)",
          separatorBefore: true,
          disabled: busy || !pullable,
          onSelect: () => {
            void runImageAction(`${image.repository}:${image.tag}`, "pull");
          },
        },
        {
          id: "remove",
          label: "삭제 (rmi)",
          separatorBefore: true,
          danger: true,
          disabled: busy,
          onSelect: () => {
            requestDestructiveImageAction(
              { id: image.id, label: namedRef },
              "remove",
            );
          },
        },
        {
          id: "force-remove",
          label: "강제 삭제 (rmi -f)",
          danger: true,
          disabled: busy,
          onSelect: () => {
            requestDestructiveImageAction(
              { id: image.id, label: namedRef },
              "force-remove",
            );
          },
        },
      );

      return items;
    },
    [busy, refresh, requestDestructiveImageAction, runImageAction],
  );

  const openContext = useCallback(
    (event: MouseEvent, image: DockerImage | null) => {
      event.preventDefault();
      event.stopPropagation();
      if (image) {
        setSelectedId(imageKey(image));
      }
      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(image),
      });
    },
    [buildMenuItems, openContextMenu, setSelectedId],
  );

  return (
    <DockerListPageShell
      titleHint="Docker 이미지 목록"
      statusLabel={(count) => `${count}개 이미지`}
      items={items}
      hasCache={hasCache}
      isFetching={isFetching}
      isActing={isActing || isConfirming}
      errorMessage={errorMessage}
      refresh={refresh}
      onPrune={requestPrune}
      pruneTooltip="미사용(dangling) 이미지 정리"
      selectedKey={selectedId}
      onSelectedKeyChange={setSelectedId}
      selectedLabel={
        selectedImage
          ? `${selectedImage.repository}:${selectedImage.tag}`
          : null
      }
      buildMenuItems={(hasSelection) =>
        buildMenuItems(hasSelection ? selectedImage : null)
      }
      tableList={
        <ImageList images={items} onImageContextMenu={openContext} />
      }
      gui={<ImageGrid images={items} onImageContextMenu={openContext} />}
    >
      {confirmDialog}
    </DockerListPageShell>
  );
}
