import { useCallback, useMemo, useState, type MouseEvent } from "react";
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
import { useRemoteFileSystem } from "@/hooks/useRemoteFileSystem";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import {
  ListSelectionProvider,
  ListSelectionSurface,
} from "@/providers/ListSelectionProvider";
import type { RemoteEntry } from "@/types/filesystem";
import { splitPathSegments } from "@/utils/file";
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

  const canGoUp = splitPathSegments(currentPath).length > 0;

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
      selectEntry(entry.path);
      setPreviewPath(entry.path);
    },
    [openEntry, selectEntry],
  );

  const buildMenuItems = useCallback(
    (targetPath: string | null): ContextMenuItem[] => {
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

      if (targetPath) {
        items.push({
          id: "delete",
          label: "삭제",
          danger: true,
          disabled: isLoading,
          onSelect: () => {
            requestConfirm({
              targetId: targetPath,
              title: "삭제 확인",
              actionName: "삭제",
              confirmButtonLabel: "삭제",
              onConfirm: () => deleteEntry(targetPath),
            });
          },
        });
      }

      return items;
    },
    [deleteEntry, isLoading, openCreateDialog, requestConfirm],
  );

  const openExplorerContextMenu = useCallback(
    (event: MouseEvent, entry: RemoteEntry | null) => {
      event.preventDefault();
      event.stopPropagation();

      if (entry) {
        selectEntry(entry.path);
      }

      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildMenuItems(entry ? entry.path : null),
      });
    },
    [buildMenuItems, openContextMenu, selectEntry],
  );

  const menuItemsForBackground = useMemo(
    () => buildMenuItems(null),
    [buildMenuItems],
  );

  return (
    <PageViewModeProvider>
      <ListSelectionProvider
        selectedKey={selectedPath}
        onSelectedKeyChange={selectEntry}
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
                  entries={entries}
                  isLoading={isLoading}
                  onOpenEntry={handleOpenEntry}
                  onEntryContextMenu={openExplorerContextMenu}
                />
              }
              gui={
                <FileIconGrid
                  entries={entries}
                  isLoading={isLoading}
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
