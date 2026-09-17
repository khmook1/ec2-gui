import { useEffect, useState } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { DangerButton } from "@/components/common/DangerButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { DetailsActionGroup } from "@/components/docker/atoms/DetailsActionGroup";
import { DetailsSummaryList } from "@/components/docker/atoms/DetailsSummaryList";
import { DetailsTabs } from "@/components/docker/atoms/DetailsTabs";
import { useDockerVolumeInspectQuery } from "@/hooks/query";
import type { DockerVolumeDestructiveAction } from "@/lib/dockerDestructiveConfirm";
import { formatDockerInspectJson } from "@/lib/formatDockerInspect";
import type { DockerVolume } from "@/types/docker";
import "../css/docker-details.css";

type DetailTab = "summary" | "actions" | "inspect";

interface VolumeDetailsDialogProps {
  volume: DockerVolume | null;
  isActing?: boolean;
  onClose: () => void;
  onRequestDestructive?: (
    target: { id: string; label: string },
    action: DockerVolumeDestructiveAction,
  ) => void;
}

const TAB_ITEMS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "요약" },
  { id: "actions", label: "액션" },
  { id: "inspect", label: "Inspect" },
];

export function VolumeDetailsDialog({
  volume,
  isActing = false,
  onClose,
  onRequestDestructive,
}: VolumeDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const volumeName = volume?.name ?? null;
  const inspectQuery = useDockerVolumeInspectQuery(volumeName);
  const isOpen = volume != null;

  useEffect(() => {
    setActiveTab("summary");
  }, [volume?.name]);

  if (!isOpen || volume == null || volumeName == null) {
    return null;
  }

  const needsRemote = activeTab === "inspect";
  const isLoading =
    needsRemote && (inspectQuery.isPending || inspectQuery.isFetching);
  const errorMessage =
    needsRemote && inspectQuery.isError
      ? inspectQuery.error instanceof Error
        ? inspectQuery.error.message
        : "볼륨 상세 정보를 불러오지 못했습니다."
      : null;

  return (
    <AppDialog
      open
      onClose={onClose}
      title={volume.name}
      subtitle={volume.driver || undefined}
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
        <LoadingIndicator layout="dialog" message="볼륨 정보를 불러오는 중" />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && activeTab === "summary" ? (
        <DetailsSummaryList
          rows={[
            { label: "이름", value: volume.name },
            { label: "Driver", value: volume.driver },
            { label: "Scope", value: volume.scope },
            { label: "Mountpoint", value: volume.mountpoint },
          ]}
        />
      ) : null}

      {activeTab === "actions" ? (
        <div className="docker-details__actions">
          <p className="docker-details__actions-status">
            대상: <strong>{volume.name}</strong>
          </p>
          <DetailsActionGroup title="볼륨" description="볼륨을 삭제합니다.">
            <DangerButton
              type="button"
              disabled={isActing}
              onClick={() =>
                onRequestDestructive?.(
                  { id: volume.name, label: volume.name },
                  "remove",
                )
              }
            >
              삭제 (rm)
            </DangerButton>
            <DangerButton
              type="button"
              disabled={isActing}
              onClick={() =>
                onRequestDestructive?.(
                  { id: volume.name, label: volume.name },
                  "force-remove",
                )
              }
            >
              강제 삭제 (rm -f)
            </DangerButton>
          </DetailsActionGroup>
        </div>
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
