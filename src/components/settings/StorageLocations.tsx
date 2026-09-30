import { useMemo } from "react";
import {
  ToolbarSvg,
  type ToolbarIconProps,
} from "@/components/icons/ToolbarIcons";
import { ROUTE_ID } from "@/config/Route";
import {
  useOpenStorageLocationMutation,
  useRemoteDirectoryQuery,
  useRemoteHomeQuery,
  useSessionKey,
  useStoragePathsQuery,
} from "@/hooks/query";
import type { StorageLocation } from "@/services/tauri/settings";
import { useExplorerNavStore } from "@/stores/explorerNavStore";
import { useNavStore } from "@/stores/navStore";
import { joinRemotePath } from "@/utils/file";

const REMOTE_BASE_DIR = ".ec2-gui";

type StorageKind = "folder" | "file";

interface LocalStorageItem {
  location: StorageLocation;
  title: string;
  kind: StorageKind;
}

const LOCAL_ITEMS: LocalStorageItem[] = [
  { location: "appData", title: "앱 데이터", kind: "folder" },
  { location: "settingsFile", title: "설정", kind: "file" },
  { location: "favoritesFile", title: "즐겨찾기", kind: "file" },
  { location: "wallpapers", title: "배경 이미지", kind: "folder" },
  // TODO: 폴더 열기가 동작하지 않아 숨김
  // { location: "webviewData", title: "접속 기록 · WebView", kind: "folder" },
  // { location: "cache", title: "캐시", kind: "folder" },
  // { location: "logs", title: "로그", kind: "folder" },
];

interface RemoteStorageItem {
  name: string | null;
  title: string;
}

const REMOTE_ITEMS: RemoteStorageItem[] = [
  { name: null, title: "원격 데이터" },
  { name: "disk-history", title: "디스크 기록" },
  { name: "resource-history", title: "리소스 기록" },
];

function FolderIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </ToolbarSvg>
  );
}

function FileIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </ToolbarSvg>
  );
}

function OpenArrowIcon(props: ToolbarIconProps) {
  return (
    <ToolbarSvg {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </ToolbarSvg>
  );
}

/** macOS·Linux 홈 경로를 `~`로 줄인다. */
function shortenHomePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

interface StorageCardProps {
  title: string;
  path: string;
  kind: StorageKind;
  disabled: boolean;
  missing?: boolean;
  onOpen: () => void;
}

function StorageCard({
  title,
  path,
  kind,
  disabled,
  missing,
  onOpen,
}: StorageCardProps) {
  const Icon = kind === "file" ? FileIcon : FolderIcon;
  return (
    <button
      type="button"
      className={[
        "settings-storage-card",
        missing ? "settings-storage-card--missing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      title={missing ? "아직 생성되지 않았습니다" : path}
      onClick={onOpen}
    >
      <span className="settings-storage-card__icon">
        <Icon />
      </span>
      <span className="settings-storage-card__body">
        <span className="settings-storage-card__title">{title}</span>
        <span className="settings-storage-card__path">
          {`\u200E${missing ? "없음" : path}`}
        </span>
      </span>
      <OpenArrowIcon className="settings-storage-card__open" />
    </button>
  );
}

export interface StorageLocationsProps {
  disabled?: boolean;
  onError: (message: string) => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function StorageLocations({ disabled, onError }: StorageLocationsProps) {
  const pathsQuery = useStoragePathsQuery();
  const openMutation = useOpenStorageLocationMutation();
  const sessionKey = useSessionKey();
  const homeQuery = useRemoteHomeQuery();
  const setPendingTarget = useExplorerNavStore(
    (state) => state.setPendingTarget,
  );
  const setActiveId = useNavStore((state) => state.setActiveId);

  const remoteBase = homeQuery.data
    ? joinRemotePath(homeQuery.data, REMOTE_BASE_DIR)
    : null;
  const remoteDirQuery = useRemoteDirectoryQuery(remoteBase);
  const remoteNames = useMemo(
    () => new Set(remoteDirQuery.data?.entries.map((entry) => entry.name)),
    [remoteDirQuery.data],
  );
  const remoteBaseExists = remoteDirQuery.isSuccess;

  const paths = pathsQuery.data ?? null;

  async function handleOpenLocal(location: StorageLocation) {
    try {
      await openMutation.mutateAsync(location);
    } catch (err) {
      onError(toErrorMessage(err, "폴더를 열지 못했습니다."));
    }
  }

  function handleOpenRemote(item: RemoteStorageItem) {
    if (!remoteBase) return;
    setPendingTarget({
      directory: item.name ? joinRemotePath(remoteBase, item.name) : remoteBase,
    });
    setActiveId(ROUTE_ID.fileExplorer);
  }

  return (
    <div className="settings-storage">
      <h3 className="settings-storage__heading">이 컴퓨터</h3>
      <div className="settings-storage__grid" aria-label="로컬 저장 위치">
        {LOCAL_ITEMS.map((item) => (
          <StorageCard
            key={item.location}
            title={item.title}
            kind={item.kind}
            path={
              paths ? shortenHomePath(paths[item.location]) : "불러오는 중…"
            }
            disabled={Boolean(disabled) || !paths}
            onOpen={() => void handleOpenLocal(item.location)}
          />
        ))}
      </div>

      <h3 className="settings-storage__heading">원격 서버</h3>
      {sessionKey ? (
        <div className="settings-storage__grid" aria-label="원격 저장 위치">
          {REMOTE_ITEMS.map((item) => {
            const exists = item.name
              ? remoteNames.has(item.name)
              : remoteBaseExists;
            return (
              <StorageCard
                key={item.name ?? "base"}
                title={item.title}
                kind="folder"
                path={`~/${REMOTE_BASE_DIR}${item.name ? `/${item.name}` : ""}`}
                missing={!exists && !remoteDirQuery.isPending}
                disabled={Boolean(disabled) || !remoteBase || !exists}
                onOpen={() => handleOpenRemote(item)}
              />
            );
          })}
        </div>
      ) : (
        <p className="settings-storage__empty">
          서버에 접속하면 표시됩니다.
        </p>
      )}
    </div>
  );
}
