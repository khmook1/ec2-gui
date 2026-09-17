import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { IconButton } from "@/components/common/IconButton";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { PageToolbar } from "@/components/common/PageToolbar";
import {
  PageViewModeProvider,
  PageViewSwitch,
} from "@/components/common/PageViewMode";
import {
  getDockerDestructiveConfirmMeta,
  type DockerDestructiveAction,
} from "@/lib/dockerDestructiveConfirm";
import { DockerContainerDetailsDialog } from "@/components/docker/ContainerDetailsDialog";
import { ContainerGrid } from "@/components/docker/atoms/ContainerGrid";
import { ContainerList } from "@/components/docker/atoms/ContainerList";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { useRemoteDocker } from "@/hooks/useRemoteDocker";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import {
  ListSelectionProvider,
  ListSelectionSurface,
} from "@/providers/ListSelectionProvider";
import {
  getDockerContainerState,
  isDockerContainerActive,
  isNginxContainer,
  type DockerContainer,
  type DockerContainerAction,
} from "@/types/docker";

export function DockerContainersPage() {
  const {
    containers,
    hasCache,
    isFetching,
    isActing,
    errorMessage,
    refresh,
    runAction,
  } = useRemoteDocker();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const busy = isFetching || isActing || isConfirming;

  const selectedContainer = useMemo(
    () => containers.find((container) => container.id === selectedId) ?? null,
    [containers, selectedId],
  );

  const openContainerDetails = useCallback((container: DockerContainer) => {
    setSelectedId(container.id);
    setDetailsTarget({ id: container.id, name: container.names });
  }, []);

  const runContainerAction = useCallback(
    async (containerId: string, action: DockerContainerAction) => {
      await runAction(containerId, action);
    },
    [runAction],
  );

  const requestDestructiveAction = useCallback(
    (
      container: Pick<DockerContainer, "id" | "names">,
      action: DockerDestructiveAction,
      options?: { closeDetails?: boolean },
    ) => {
      const meta = getDockerDestructiveConfirmMeta(action);
      requestConfirm({
        targetId: container.id,
        label: container.names,
        ...meta,
        onConfirm: async () => {
          await runContainerAction(container.id, action);
          if (options?.closeDetails) {
            setDetailsTarget(null);
          }
        },
      });
    },
    [requestConfirm, runContainerAction],
  );

  const buildMenuItems = useCallback(
    (container: DockerContainer | null): ContextMenuItem[] => {
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

      if (!container) {
        return items;
      }

      const state = getDockerContainerState(container.status);
      const isRunning = state === "running";
      const isPaused = state === "paused";
      const isActive = isDockerContainerActive(state);
      const isStartable = state === "stopped" || state === "unknown";
      const nginx = isNginxContainer(container);

      items.push(
        {
          id: "details",
          label: "상세 정보",
          separatorBefore: true,
          onSelect: () => {
            openContainerDetails(container);
          },
        },
        {
          id: "start",
          label: "시작",
          separatorBefore: true,
          disabled: busy || !isStartable,
          onSelect: () => {
            void runContainerAction(container.id, "start");
          },
        },
        {
          id: "stop",
          label: "중지",
          disabled: busy || !isActive,
          onSelect: () => {
            void runContainerAction(container.id, "stop");
          },
        },
        {
          id: "restart",
          label: "재시작",
          disabled: busy,
          onSelect: () => {
            void runContainerAction(container.id, "restart");
          },
        },
        {
          id: "kill",
          label: "강제 종료",
          danger: true,
          disabled: busy || !isActive,
          onSelect: () => {
            requestDestructiveAction(container, "kill");
          },
        },
        {
          id: "pause",
          label: "일시정지",
          separatorBefore: true,
          disabled: busy || !isRunning,
          onSelect: () => {
            void runContainerAction(container.id, "pause");
          },
        },
        {
          id: "unpause",
          label: "재개",
          disabled: busy || !isPaused,
          onSelect: () => {
            void runContainerAction(container.id, "unpause");
          },
        },
      );

      if (nginx) {
        items.push(
          {
            id: "nginx-test",
            label: "nginx 설정 검사 (-t)",
            separatorBefore: true,
            disabled: busy || !isRunning,
            onSelect: () => {
              void runContainerAction(container.id, "nginx-test");
            },
          },
          {
            id: "nginx-reload",
            label: "nginx 리로드",
            disabled: busy || !isRunning,
            onSelect: () => {
              void runContainerAction(container.id, "nginx-reload");
            },
          },
          {
            id: "nginx-version",
            label: "nginx 버전",
            disabled: busy || !isRunning,
            onSelect: () => {
              void runContainerAction(container.id, "nginx-version");
            },
          },
          {
            id: "nginx-quit",
            label: "nginx 정상 종료 (-s quit)",
            disabled: busy || !isRunning,
            onSelect: () => {
              void runContainerAction(container.id, "nginx-quit");
            },
          },
        );
      }

      items.push(
        {
          id: "remove",
          label: "삭제",
          separatorBefore: true,
          danger: true,
          disabled: busy || isActive,
          onSelect: () => {
            requestDestructiveAction(container, "remove");
          },
        },
        {
          id: "force-remove",
          label: "강제 삭제",
          danger: true,
          disabled: busy,
          onSelect: () => {
            requestDestructiveAction(container, "force-remove");
          },
        },
      );

      return items;
    },
    [
      busy,
      openContainerDetails,
      refresh,
      requestDestructiveAction,
      runContainerAction,
    ],
  );

  const openDockerContextMenu = useCallback(
    (event: MouseEvent, container: DockerContainer | null) => {
      event.preventDefault();
      event.stopPropagation();

      if (container) {
        setSelectedId(container.id);
      }

      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(container),
      });
    },
    [buildMenuItems, openContextMenu],
  );

  const menuItemsForBackground = useMemo(
    () => buildMenuItems(null),
    [buildMenuItems],
  );

  return (
    <PageViewModeProvider>
      <ListSelectionProvider
        selectedKey={selectedId}
        onSelectedKeyChange={setSelectedId}
      >
        <section
          className="explorer docker-page"
          onContextMenu={(event) => {
            event.preventDefault();
            openContextMenu({
              x: event.clientX,
              y: event.clientY,
              items: menuItemsForBackground,
            });
          }}
        >
          <PageToolbar
            actions={
              <IconButton
                tone="success"
                tooltip="새로고침"
                disabled={busy}
                onClick={() => void refresh()}
                aria-label="새로고침"
              >
                <RefreshIcon />
              </IconButton>
            }
          >
            <p className="page-toolbar__hint">Docker 컨테이너 관리</p>
          </PageToolbar>

          <AsyncDataLoader
            isLoading={isFetching && !hasCache}
            hasData={hasCache}
          >
            {errorMessage ? (
              <p className="explorer-error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <ListSelectionSurface className="explorer__selection-surface">
              <PageViewSwitch
                tableList={
                  <ContainerList
                    containers={containers}
                    onOpenContainer={openContainerDetails}
                    onContainerContextMenu={openDockerContextMenu}
                  />
                }
                gui={
                  <ContainerGrid
                    containers={containers}
                    onOpenContainer={openContainerDetails}
                    onContainerContextMenu={openDockerContextMenu}
                  />
                }
              />
            </ListSelectionSurface>

            <footer className="explorer-statusbar">
              <span>{containers.length}개 컨테이너</span>
              {selectedContainer ? (
                <span>{selectedContainer.names}</span>
              ) : isActing ? (
                <span>명령 실행 중…</span>
              ) : isFetching ? (
                <span>갱신 중…</span>
              ) : null}
            </footer>
          </AsyncDataLoader>
        </section>

        <DockerContainerDetailsDialog
          key={detailsTarget?.id ?? "docker-details-closed"}
          containerId={detailsTarget?.id ?? null}
          containerName={detailsTarget?.name ?? null}
          containerImage={selectedContainer?.image ?? null}
          containerStatus={selectedContainer?.status ?? null}
          isActing={busy}
          onClose={() => setDetailsTarget(null)}
          onAction={runContainerAction}
          onRequestDestructive={(action) => {
            if (!detailsTarget) {
              return;
            }
            requestDestructiveAction(
              { id: detailsTarget.id, names: detailsTarget.name },
              action,
              { closeDetails: true },
            );
          }}
        />

        {confirmDialog}
      </ListSelectionProvider>
    </PageViewModeProvider>
  );
}
