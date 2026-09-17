import { useEffect, useState } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { DetailsTabs } from "@/components/docker/atoms/DetailsTabs";
import { useDockerSystemOutputQuery } from "@/hooks/query";
import type { DockerSystemAction } from "@/types/docker";
import "../css/docker-details.css";

type SystemViewAction = Extract<DockerSystemAction, "df" | "info">;

interface SystemDetailsDialogProps {
  action: SystemViewAction | null;
  onClose: () => void;
}

const TAB_ITEMS: Array<{ id: SystemViewAction; label: string }> = [
  { id: "df", label: "디스크 사용량" },
  { id: "info", label: "시스템 정보" },
];

const TITLES: Record<SystemViewAction, string> = {
  df: "디스크 사용량",
  info: "시스템 정보",
};

const FILENAMES: Record<SystemViewAction, string> = {
  df: "system-df.txt",
  info: "system-info.txt",
};

export function SystemDetailsDialog({
  action,
  onClose,
}: SystemDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<SystemViewAction>(action ?? "df");
  const outputQuery = useDockerSystemOutputQuery(action ? activeTab : null);
  const isOpen = action != null;

  useEffect(() => {
    if (action) {
      setActiveTab(action);
    }
  }, [action]);

  if (!isOpen) {
    return null;
  }

  const isLoading = outputQuery.isPending || outputQuery.isFetching;
  const errorMessage = outputQuery.isError
    ? outputQuery.error instanceof Error
      ? outputQuery.error.message
      : "시스템 정보를 불러오지 못했습니다."
    : null;

  return (
    <AppDialog
      open
      onClose={onClose}
      title={TITLES[activeTab]}
      subtitle={`docker system ${activeTab === "df" ? "df" : "info"}`}
      busy={isLoading}
      size="wide"
      toolbar={
        <DetailsTabs
          items={TAB_ITEMS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as SystemViewAction)}
        />
      }
      bodyClassName="docker-details__body"
    >
      {isLoading ? (
        <LoadingIndicator layout="dialog" message="시스템 정보를 불러오는 중" />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage ? (
        <CodeBlock
          code={outputQuery.data?.trim() || "(결과 없음)"}
          filename={FILENAMES[activeTab]}
        />
      ) : null}
    </AppDialog>
  );
}
