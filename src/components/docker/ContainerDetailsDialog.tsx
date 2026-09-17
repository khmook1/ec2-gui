import { useEffect, useState } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { DetailsActionsPanel } from "@/components/docker/atoms/DetailsActionsPanel";
import { DetailsSummary } from "@/components/docker/atoms/DetailsSummary";
import { LogsPanel } from "@/components/docker/atoms/LogsPanel";
import { DockerProcessCards } from "@/components/docker/ProcessCards";
import { DockerStatsCards } from "@/components/docker/StatsCards";
import { useDockerContainerDetailsQuery } from "@/hooks/query";
import type { DockerDestructiveAction } from "@/lib/dockerDestructiveConfirm";
import {
  getDockerContainerState,
  isDockerContainerActive,
  isNginxContainer,
  type DockerContainerAction,
} from "@/types/docker";
import "./css/docker-details.css";

type DetailTab = "summary" | "actions" | "stats" | "top" | "logs" | "inspect";

interface DockerContainerDetailsDialogProps {
  containerId: string | null;
  containerName?: string | null;
  containerImage?: string | null;
  containerStatus?: string | null;
  isActing?: boolean;
  onClose: () => void;
  onAction?: (
    containerId: string,
    action: DockerContainerAction,
  ) => Promise<unknown>;
  onRequestDestructive?: (action: DockerDestructiveAction) => void;
}

const TAB_ITEMS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "요약" },
  { id: "actions", label: "액션" },
  { id: "stats", label: "리소스" },
  { id: "top", label: "프로세스" },
  { id: "logs", label: "로그" },
  { id: "inspect", label: "Inspect" },
];

export function DockerContainerDetailsDialog({
  containerId,
  containerName = null,
  containerImage = null,
  containerStatus = null,
  isActing = false,
  onClose,
  onAction,
  onRequestDestructive,
}: DockerContainerDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const detailsQuery = useDockerContainerDetailsQuery(containerId);
  const details = detailsQuery.data ?? null;
  const isLoading = detailsQuery.isPending || detailsQuery.isFetching;
  const errorMessage = detailsQuery.isError
    ? detailsQuery.error instanceof Error
      ? detailsQuery.error.message
      : "컨테이너 상세 정보를 불러오지 못했습니다."
    : null;
  const isOpen = containerId != null;

  useEffect(() => {
    setActiveTab("summary");
  }, [containerId]);

  if (!isOpen || containerId == null) {
    return null;
  }

  const openId = containerId;
  const title = details?.name || containerName || "컨테이너 상세";
  const statusText = details?.status || containerStatus || "";
  const state = getDockerContainerState(statusText);
  const isRunning = state === "running";
  const isPaused = state === "paused";
  const isActive = isDockerContainerActive(state);
  const isStopped = state === "stopped";
  const isStartable = isStopped || state === "unknown";
  const nginx = isNginxContainer({
    id: openId,
    image: details?.image || containerImage || "",
    status: statusText,
    names: details?.name || containerName || "",
    ports: details?.ports || "",
  });

  async function handleAction(action: DockerContainerAction) {
    if (!onAction) {
      return;
    }
    try {
      await onAction(openId, action);
      void detailsQuery.refetch();
    } catch {
      // useRemoteDocker.runAction에서 토스트로 표시
    }
  }

  function handleDestructive(action: DockerDestructiveAction) {
    onRequestDestructive?.(action);
  }

  const showBodyLoading = isLoading && activeTab !== "actions";
  const showBodyError = !isLoading && errorMessage && activeTab !== "actions";
  const showDetailsContent =
    !isLoading && !errorMessage && details != null && activeTab !== "actions";

  const toolbar = (
    <div
      className="docker-details__tabs"
      role="tablist"
      aria-label="상세 정보"
    >
      {TAB_ITEMS.map((tab) => {
        const disabled =
          tab.id !== "actions" && (isLoading || Boolean(errorMessage));
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            disabled={disabled}
            className={[
              "docker-details__tab",
              activeTab === tab.id ? "docker-details__tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <AppDialog
      open
      onClose={onClose}
      title={title}
      subtitle={openId}
      busy={isLoading}
      size="wide"
      toolbar={toolbar}
      bodyClassName={[
        "docker-details__body",
        activeTab === "logs" ? "docker-details__body--logs" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showBodyLoading ? (
        <LoadingIndicator
          layout="dialog"
          message="컨테이너 정보를 불러오는 중"
        />
      ) : null}

      {showBodyError ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {activeTab === "actions" ? (
        <DetailsActionsPanel
          containerId={openId}
          statusText={statusText}
          isActing={isActing}
          isStartable={isStartable}
          isActive={isActive}
          isRunning={isRunning}
          isPaused={isPaused}
          isNginx={nginx}
          onAction={(action) => void handleAction(action)}
          onDestructive={handleDestructive}
        />
      ) : null}

      {showDetailsContent && activeTab === "summary" ? (
        <DetailsSummary details={details} />
      ) : null}

      {showDetailsContent && activeTab === "stats" ? (
        <DockerStatsCards
          raw={
            details.stats ??
            "리소스 정보를 가져올 수 없습니다. (중지된 컨테이너일 수 있습니다)"
          }
        />
      ) : null}

      {showDetailsContent && activeTab === "top" ? (
        <DockerProcessCards
          raw={
            details.top ??
            "프로세스 정보를 가져올 수 없습니다. (중지된 컨테이너일 수 있습니다)"
          }
        />
      ) : null}

      {showDetailsContent && activeTab === "logs" ? (
        <LogsPanel containerId={openId} />
      ) : null}

      {showDetailsContent && activeTab === "inspect" ? (
        <CodeBlock code={details.inspectJson} filename="inspect.json" />
      ) : null}
    </AppDialog>
  );
}
