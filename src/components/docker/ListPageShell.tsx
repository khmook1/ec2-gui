import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { IconButton } from "@/components/common/IconButton";
import { AsyncDataLoader } from "@/components/common/AsyncDataLoader";
import { PageToolbar } from "@/components/common/PageToolbar";
import {
  PageViewModeProvider,
  PageViewSwitch,
} from "@/components/common/PageViewMode";
import { PruneIcon, RefreshIcon } from "@/components/icons/ToolbarIcons";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import {
  ListSelectionProvider,
  ListSelectionSurface,
} from "@/providers/ListSelectionProvider";
import "./css/docker-list.css";

interface DockerListPageProps {
  titleHint: string;
  statusLabel: (count: number) => string;
  items: unknown[];
  hasCache: boolean;
  isFetching: boolean;
  isActing?: boolean;
  errorMessage: string | null;
  refresh: () => void;
  /** 미사용 리소스 일괄 정리 (prune). 툴바 새로고침 옆에 표시 */
  onPrune?: () => void;
  pruneTooltip?: string;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  selectedLabel?: string | null;
  buildMenuItems: (hasSelection: boolean) => ContextMenuItem[];
  tableList: ReactNode;
  gui: ReactNode;
  children?: ReactNode;
}

export function DockerListPageShell({
  titleHint,
  statusLabel,
  items,
  hasCache,
  isFetching,
  isActing = false,
  errorMessage,
  refresh,
  onPrune,
  pruneTooltip = "미사용 리소스 정리 (prune)",
  selectedKey,
  onSelectedKeyChange,
  selectedLabel,
  buildMenuItems,
  tableList,
  gui,
  children,
}: DockerListPageProps) {
  const { openContextMenu } = useContextMenu();
  const busy = isFetching || isActing;

  const menuItemsForBackground = useMemo(
    () => buildMenuItems(false),
    [buildMenuItems],
  );

  const openBackgroundMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: menuItemsForBackground,
      });
    },
    [menuItemsForBackground, openContextMenu],
  );

  return (
    <PageViewModeProvider>
      <ListSelectionProvider
        selectedKey={selectedKey}
        onSelectedKeyChange={onSelectedKeyChange}
      >
        <section
          className="explorer docker-page"
          onContextMenu={openBackgroundMenu}
        >
          <PageToolbar
            actions={
              <>
                <IconButton
                  tone="success"
                  tooltip="새로고침"
                  disabled={busy}
                  onClick={() => void refresh()}
                  aria-label="새로고침"
                >
                  <RefreshIcon />
                </IconButton>
                {onPrune ? (
                  <IconButton
                    tone="danger"
                    tooltip={pruneTooltip}
                    disabled={busy}
                    onClick={onPrune}
                    aria-label={pruneTooltip}
                  >
                    <PruneIcon />
                  </IconButton>
                ) : null}
              </>
            }
          >
            <p className="page-toolbar__hint">{titleHint}</p>
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
              <PageViewSwitch tableList={tableList} gui={gui} />
            </ListSelectionSurface>

            <footer className="explorer-statusbar">
              <span>{statusLabel(items.length)}</span>
              {selectedLabel ? (
                <span>{selectedLabel}</span>
              ) : isActing ? (
                <span>명령 실행 중…</span>
              ) : isFetching ? (
                <span>갱신 중…</span>
              ) : null}
            </footer>
          </AsyncDataLoader>
        </section>
        {children}
      </ListSelectionProvider>
    </PageViewModeProvider>
  );
}

export function useDockerListSelection() {
  return useState<string | null>(null);
}
