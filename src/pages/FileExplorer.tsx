import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  PageViewModeProvider,
  PageViewSwitch,
} from "@/components/common/PageViewMode";
import {
  CreateEntryDialog,
  type CreateEntryKind,
} from "@/components/explorer/CreateEntryDialog";
import { FileContentDialog } from "@/components/explorer/FileContentDialog";
import { FileExplorerToolbar } from "@/components/explorer/FileExplorerToolbar";
import { FileIconGrid } from "@/components/explorer/FileIconGrid";
import { FileList } from "@/components/explorer/FileList";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import { useExplorerFavorites } from "@/hooks/useExplorerFavorites";
import { useExplorerLetterFocus } from "@/hooks/useExplorerLetterFocus";
import { useRemoteFileSystem } from "@/hooks/useRemoteFileSystem";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import {
  ListSelectionProvider,
  ListSelectionSurface,
} from "@/providers/ListSelectionProvider";
import { useExplorerContextStore } from "@/stores/explorerContextStore";
import type { RemoteEntry } from "@/types/filesystem";
import { getParentPath, splitPathSegments } from "@/utils/file";
import "./css/file-explorer.css";

export function FileExplorerPage() {
  const {
    currentPath,
    entries,
    isLoading,
    errorMessage,
    selectedPath,
    refresh,
    openDirectory,
    openEntry,
    goUp,
    selectEntry,
    createDirectory,
    createFile,
    deleteEntry,
  } = useRemoteFileSystem();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog } = useDestructiveConfirm();
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<CreateEntryKind | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { displayEntries, isFavorite, isShortcut, toggleFavorite } =
    useExplorerFavorites(entries, currentPath);
  const { isLetterFocused, handleSelectedKeyChange } = useExplorerLetterFocus({
    entries: displayEntries,
    selectedPath,
    selectEntry,
    currentPath,
    enabled: previewPath == null && createKind == null,
  });

  const canGoUp = splitPathSegments(currentPath).length > 0;

  const setExplorerContext = useExplorerContextStore((state) => state.setContext);
  useEffect(() => {
    setExplorerContext(
      currentPath
        ? { currentPath, selectedPath, openFile: previewPath }
        : null,
    );
  }, [currentPath, selectedPath, previewPath, setExplorerContext]);
  useEffect(() => () => setExplorerContext(null), [setExplorerContext]);

  const handleClosePreview = useCallback(() => {
    setPreviewPath(null);
  }, []);

  const openCreateDialog = useCallback((kind: CreateEntryKind) => {
    setCreateError(null);
    setCreateKind(kind);
  }, []);

  const handleCloseCreate = useCallback(() => {
    if (isCreating) {
      return;
    }
    setCreateError(null);
    setCreateKind(null);
  }, [isCreating]);

  const handleCreateSubmit = useCallback(
    async ({ name, content }: { name: string; content: string }) => {
      setIsCreating(true);
      setCreateError(null);
      try {
        if (createKind === "directory") {
          await createDirectory(name);
        } else if (createKind === "file") {
          await createFile(name, content);
        }
        setCreateKind(null);
      } catch (error) {
        setCreateError(
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "생성에 실패했습니다.",
        );
      } finally {
        setIsCreating(false);
      }
    },
    [createDirectory, createFile, createKind],
  );

  const handleOpenEntry = useCallback(
    (entry: RemoteEntry) => {
      if (entry.isDirectory) {
        void openEntry(entry);
        return;
      }
      handleSelectedKeyChange(entry.path);
      setPreviewPath(entry.path);
    },
    [handleSelectedKeyChange, openEntry],
  );

  const buildMenuItems = useCallback(
    (target: RemoteEntry | null): ContextMenuItem[] => {
      if (target && isShortcut(target)) {
        return [
          {
            id: "open-original-location",
            label: "원래 위치 열기",
            disabled: isLoading,
            onSelect: () => {
              void openDirectory(getParentPath(target.path));
            },
          },
          {
            id: "remove-favorite",
            label: "즐겨찾기 해제",
            onSelect: () => {
              toggleFavorite(target);
            },
          },
        ];
      }

      const items: ContextMenuItem[] = [
        {
          id: "create-folder",
          label: "폴더 추가",
          disabled: isLoading,
          onSelect: () => {
            openCreateDialog("directory");
          },
        },
        {
          id: "create-file",
          label: "파일 생성",
          disabled: isLoading,
          onSelect: () => {
            openCreateDialog("file");
          },
        },
      ];

      if (target) {
        items.push({
          id: "delete",
          label: "삭제",
          danger: true,
          disabled: isLoading,
          onSelect: () => {
            requestConfirm({
              targetId: target.path,
              title: "삭제 확인",
              actionName: "삭제",
              confirmButtonLabel: "삭제",
              onConfirm: () => deleteEntry(target.path),
            });
          },
        });
      }

      return items;
    },
    [
      deleteEntry,
      isLoading,
      isShortcut,
      openCreateDialog,
      openDirectory,
      requestConfirm,
      toggleFavorite,
    ],
  );

  const openExplorerContextMenu = useCallback(
    (event: MouseEvent, entry: RemoteEntry | null) => {
      event.preventDefault();
      event.stopPropagation();

      if (entry) {
        handleSelectedKeyChange(entry.path);
      }

      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(entry),
      });
    },
    [buildMenuItems, handleSelectedKeyChange, openContextMenu],
  );

  const menuItemsForBackground = useMemo(
    () => buildMenuItems(null),
    [buildMenuItems],
  );

  return (
    <PageViewModeProvider>
      <ListSelectionProvider
        selectedKey={selectedPath}
        onSelectedKeyChange={handleSelectedKeyChange}
      >
        <section
          className="explorer"
          onContextMenu={(event) => {
            event.preventDefault();
            openContextMenu({
              x: event.clientX,
              y: event.clientY,
              items: menuItemsForBackground,
            });
          }}
        >
          <FileExplorerToolbar
            currentPath={currentPath}
            isLoading={isLoading}
            canGoUp={canGoUp}
            onGoUp={() => void goUp()}
            onRefresh={() => void refresh()}
            onNavigate={(path) => void openDirectory(path)}
          />

          {errorMessage ? (
            <p className="explorer-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <ListSelectionSurface className="explorer__selection-surface">
            <PageViewSwitch
              tableList={
                <FileList
                  entries={displayEntries}
                  isLoading={isLoading}
                  isLetterFocused={isLetterFocused}
                  isFavorite={isFavorite}
                  isShortcut={isShortcut}
                  onToggleFavorite={toggleFavorite}
                  onOpenEntry={handleOpenEntry}
                  onEntryContextMenu={openExplorerContextMenu}
                />
              }
              gui={
                <FileIconGrid
                  entries={displayEntries}
                  isLoading={isLoading}
                  isLetterFocused={isLetterFocused}
                  isFavorite={isFavorite}
                  isShortcut={isShortcut}
                  onToggleFavorite={toggleFavorite}
                  onOpenEntry={handleOpenEntry}
                  onEntryContextMenu={openExplorerContextMenu}
                />
              }
            />
          </ListSelectionSurface>

          <footer className="explorer-statusbar">
            <span>{entries.length}개 항목</span>
            {selectedPath ? <span>{selectedPath}</span> : null}
          </footer>
        </section>

        {confirmDialog}
      </ListSelectionProvider>

      <CreateEntryDialog
        kind={createKind}
        parentPath={currentPath}
        isSubmitting={isCreating}
        errorMessage={createError}
        onClose={handleCloseCreate}
        onSubmit={handleCreateSubmit}
      />

      <FileContentDialog
        key={previewPath ?? "file-preview-closed"}
        path={previewPath}
        onClose={handleClosePreview}
      />
    </PageViewModeProvider>
  );
}
