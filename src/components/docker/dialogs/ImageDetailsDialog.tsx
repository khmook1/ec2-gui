import { useEffect, useState } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { CodeBlock } from "@/components/common/CodeBlock";
import { DangerButton } from "@/components/common/DangerButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { DetailsActionGroup } from "@/components/docker/atoms/DetailsActionGroup";
import { DetailsSummaryList } from "@/components/docker/atoms/DetailsSummaryList";
import { DetailsTabs } from "@/components/docker/atoms/DetailsTabs";
import {
  useDockerImageHistoryQuery,
  useDockerImageInspectQuery,
} from "@/hooks/query";
import type { DockerImageDestructiveAction } from "@/lib/dockerDestructiveConfirm";
import { formatDockerInspectJson } from "@/lib/formatDockerInspect";
import {
  canPullDockerImage,
  getDockerImageRef,
  type DockerImage,
  type DockerImageAction,
} from "@/types/docker";
import "../css/docker-details.css";

type DetailTab = "summary" | "actions" | "history" | "inspect";

interface ImageDetailsDialogProps {
  image: DockerImage | null;
  initialTab?: DetailTab;
  isActing?: boolean;
  onClose: () => void;
  onAction?: (imageRef: string, action: DockerImageAction) => Promise<unknown>;
  onRequestDestructive?: (
    target: { id: string; label: string },
    action: DockerImageDestructiveAction,
  ) => void;
}

const TAB_ITEMS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "요약" },
  { id: "actions", label: "액션" },
  { id: "history", label: "히스토리" },
  { id: "inspect", label: "Inspect" },
];

export function ImageDetailsDialog({
  image,
  initialTab = "summary",
  isActing = false,
  onClose,
  onAction,
  onRequestDestructive,
}: ImageDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
  const imageRef = image ? getDockerImageRef(image) : null;
  const inspectQuery = useDockerImageInspectQuery(imageRef);
  const historyQuery = useDockerImageHistoryQuery(imageRef, {
    enabled: activeTab === "history",
  });
  const isOpen = image != null;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [image?.id, image?.repository, image?.tag, initialTab]);

  if (!isOpen || image == null || imageRef == null) {
    return null;
  }

  const openImage = image;
  const title = `${openImage.repository}:${openImage.tag}`;
  const pullable = canPullDockerImage(openImage);
  const namedRef = getDockerImageRef(openImage);

  const activeQuery = activeTab === "history" ? historyQuery : inspectQuery;
  const needsRemote = activeTab === "history" || activeTab === "inspect";
  const isLoading =
    needsRemote && (activeQuery.isPending || activeQuery.isFetching);
  const errorMessage =
    needsRemote && activeQuery.isError
      ? activeQuery.error instanceof Error
        ? activeQuery.error.message
        : "이미지 상세 정보를 불러오지 못했습니다."
      : null;

  async function handleAction(action: DockerImageAction) {
    if (!onAction) {
      return;
    }
    try {
      const ref =
        action === "pull"
          ? `${openImage.repository}:${openImage.tag}`
          : openImage.id;
      await onAction(ref, action);
      if (action === "inspect") {
        void inspectQuery.refetch();
      }
      if (action === "history") {
        void historyQuery.refetch();
      }
    } catch {
      // 페이지에서 토스트 처리
    }
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      title={title}
      subtitle={openImage.id}
      busy={isLoading}
      size="wide"
      toolbar={
        <DetailsTabs
          items={TAB_ITEMS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as DetailTab)}
        />
      }
      bodyClassName="docker-details__body"
    >
      {isLoading ? (
        <LoadingIndicator layout="dialog" message="이미지 정보를 불러오는 중" />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && activeTab === "summary" ? (
        <DetailsSummaryList
          rows={[
            { label: "Repository", value: openImage.repository },
            { label: "Tag", value: openImage.tag },
            { label: "Image ID", value: openImage.id },
            { label: "생성", value: openImage.createdSince },
            { label: "크기", value: openImage.size },
          ]}
        />
      ) : null}

      {activeTab === "actions" ? (
        <div className="docker-details__actions">
          <p className="docker-details__actions-status">
            대상: <strong>{namedRef}</strong>
          </p>
          <DetailsActionGroup
            title="이미지"
            description="다시 받거나 삭제합니다."
          >
            <Button
              type="button"
              variant="ghost"
              disabled={isActing || !pullable}
              onClick={() => void handleAction("pull")}
            >
              다시 받기 (pull)
            </Button>
            <DangerButton
              type="button"
              disabled={isActing}
              onClick={() =>
                onRequestDestructive?.(
                  { id: openImage.id, label: namedRef },
                  "remove",
                )
              }
            >
              삭제 (rmi)
            </DangerButton>
            <DangerButton
              type="button"
              disabled={isActing}
              onClick={() =>
                onRequestDestructive?.(
                  { id: openImage.id, label: namedRef },
                  "force-remove",
                )
              }
            >
              강제 삭제 (rmi -f)
            </DangerButton>
          </DetailsActionGroup>
        </div>
      ) : null}

      {!isLoading && !errorMessage && activeTab === "history" ? (
        <CodeBlock
          code={historyQuery.data?.trim() || "(히스토리 없음)"}
          filename="history.txt"
        />
      ) : null}

      {!isLoading && !errorMessage && activeTab === "inspect" ? (
        <CodeBlock
          code={formatDockerInspectJson(inspectQuery.data ?? "")}
          filename="inspect.json"
        />
      ) : null}
    </AppDialog>
  );
}
