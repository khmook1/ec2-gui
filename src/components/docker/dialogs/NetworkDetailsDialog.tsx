import { useEffect, useState } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { DangerButton } from "@/components/common/DangerButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { DetailsActionGroup } from "@/components/docker/atoms/DetailsActionGroup";
import { DetailsSummaryList } from "@/components/docker/atoms/DetailsSummaryList";
import { DetailsTabs } from "@/components/docker/atoms/DetailsTabs";
import { useDockerNetworkInspectQuery } from "@/hooks/query";
import type { DockerNetworkDestructiveAction } from "@/lib/dockerDestructiveConfirm";
import { formatDockerInspectJson } from "@/lib/formatDockerInspect";
import { isBuiltinDockerNetwork, type DockerNetwork } from "@/types/docker";
import "../css/docker-details.css";

type DetailTab = "summary" | "actions" | "inspect";

interface NetworkDetailsDialogProps {
  network: DockerNetwork | null;
  isActing?: boolean;
  onClose: () => void;
  onRequestDestructive?: (
    target: { id: string; label: string; ref: string },
    action: DockerNetworkDestructiveAction,
  ) => void;
}

const TAB_ITEMS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "요약" },
  { id: "actions", label: "액션" },
  { id: "inspect", label: "Inspect" },
];

export function NetworkDetailsDialog({
  network,
  isActing = false,
  onClose,
  onRequestDestructive,
}: NetworkDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const networkRef = network ? network.name || network.id : null;
  const inspectQuery = useDockerNetworkInspectQuery(networkRef);
  const isOpen = network != null;

  useEffect(() => {
    setActiveTab("summary");
  }, [network?.id]);

  if (!isOpen || network == null || networkRef == null) {
    return null;
  }

  const builtin = isBuiltinDockerNetwork(network);
  const needsRemote = activeTab === "inspect";
  const isLoading =
    needsRemote && (inspectQuery.isPending || inspectQuery.isFetching);
  const errorMessage =
    needsRemote && inspectQuery.isError
      ? inspectQuery.error instanceof Error
        ? inspectQuery.error.message
        : "네트워크 상세 정보를 불러오지 못했습니다."
      : null;

  return (
    <AppDialog
      open
      onClose={onClose}
      title={network.name || "네트워크 상세"}
      subtitle={network.id}
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
        <LoadingIndicator
          layout="dialog"
          message="네트워크 정보를 불러오는 중"
        />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && activeTab === "summary" ? (
        <DetailsSummaryList
          rows={[
            { label: "이름", value: network.name },
            { label: "ID", value: network.id },
            { label: "Driver", value: network.driver },
            { label: "Scope", value: network.scope },
          ]}
        />
      ) : null}

      {activeTab === "actions" ? (
        <div className="docker-details__actions">
          <p className="docker-details__actions-status">
            대상: <strong>{network.name}</strong>
            {builtin ? " (기본 네트워크는 삭제할 수 없습니다)" : null}
          </p>
          <DetailsActionGroup
            title="네트워크"
            description="네트워크를 삭제합니다."
          >
            <DangerButton
              type="button"
              disabled={isActing || builtin}
              onClick={() =>
                onRequestDestructive?.(
                  {
                    id: network.id,
                    label: network.name,
                    ref: networkRef,
                  },
                  "remove",
                )
              }
            >
              삭제 (rm)
            </DangerButton>
            <DangerButton
              type="button"
              disabled={isActing || builtin}
              onClick={() =>
                onRequestDestructive?.(
                  {
                    id: network.id,
                    label: network.name,
                    ref: networkRef,
                  },
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
