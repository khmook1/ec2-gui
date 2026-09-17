import { useCallback, type MouseEvent } from "react";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { PageToolbar } from "@/components/common/PageToolbar";
import { useDockerSystemActionMutation } from "@/hooks/query";
import { useDestructiveConfirm } from "@/hooks/useDestructiveConfirm";
import {
  getDockerActionErrorMessage,
  truncateDockerOutput,
} from "@/lib/dockerActionResult";
import {
  getDockerSystemDestructiveConfirmMeta,
  type DockerSystemDestructiveAction,
} from "@/lib/dockerDestructiveConfirm";
import {
  useContextMenu,
  type ContextMenuItem,
} from "@/providers/ContextMenuProvider";
import { useToast } from "@/providers/ToastProvider";
import type { DockerSystemAction } from "@/types/docker";
import "@/components/docker/css/docker-placeholder.css";

interface SystemCommandItem {
  id: DockerSystemAction;
  label: string;
  command: string;
  description: string;
  danger?: boolean;
  mono?: boolean;
}

const SYSTEM_COMMANDS: SystemCommandItem[] = [
  {
    id: "df",
    label: "디스크 사용량",
    command: "docker system df",
    description: "이미지·컨테이너·볼륨·빌드 캐시 사용량을 확인합니다.",
    mono: true,
  },
  {
    id: "info",
    label: "시스템 정보",
    command: "docker info",
    description: "Docker 데몬·런타임 정보를 확인합니다.",
    mono: true,
  },
  {
    id: "prune",
    label: "미사용 리소스 정리",
    command: "docker system prune -f",
    description: "중지된 컨테이너·미사용 네트워크·dangling 이미지·빌드 캐시를 정리합니다.",
    danger: true,
  },
  {
    id: "prune-all",
    label: "미사용 이미지 포함 정리",
    command: "docker system prune -a -f",
    description: "사용 중이지 않은 이미지까지 포함해 정리합니다.",
    danger: true,
  },
  {
    id: "prune-volumes",
    label: "볼륨 포함 전체 정리",
    command: "docker system prune -a --volumes -f",
    description: "미사용 볼륨까지 포함해 정리합니다. 데이터가 삭제될 수 있습니다.",
    danger: true,
  },
];

function isDestructiveSystemAction(
  action: DockerSystemAction,
): action is DockerSystemDestructiveAction {
  return (
    action === "prune" ||
    action === "prune-all" ||
    action === "prune-volumes"
  );
}

export function DockerSystemPage() {
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const { requestConfirm, confirmDialog, isConfirming } =
    useDestructiveConfirm();
  const systemAction = useDockerSystemActionMutation();
  const busy = systemAction.isPending || isConfirming;

  const runSystemAction = useCallback(
    async (action: DockerSystemAction) => {
      try {
        const output = await systemAction.mutateAsync(action);
        const trimmed = truncateDockerOutput(output);
        const item = SYSTEM_COMMANDS.find((command) => command.id === action);
        if (trimmed) {
          toast.success(trimmed, { mono: item?.mono ?? true });
        } else {
          toast.success("명령을 실행했습니다.");
        }
        return output;
      } catch (error) {
        toast.error(
          getDockerActionErrorMessage(
            error,
            "Docker 시스템 명령을 실행하지 못했습니다.",
          ),
        );
        throw error;
      }
    },
    [systemAction, toast],
  );

  const requestOrRun = useCallback(
    (action: DockerSystemAction) => {
      if (!isDestructiveSystemAction(action)) {
        void runSystemAction(action);
        return;
      }

      const item = SYSTEM_COMMANDS.find((command) => command.id === action);
      const meta = getDockerSystemDestructiveConfirmMeta(action);
      requestConfirm({
        targetId: action,
        label: item?.command ?? action,
        ...meta,
        onConfirm: async () => {
          await runSystemAction(action);
        },
      });
    },
    [requestConfirm, runSystemAction],
  );

  const menuItems = useCallback((): ContextMenuItem[] => {
    // prune은 페이지 버튼으로만 제공 (일괄 정리)
    return SYSTEM_COMMANDS.filter((item) => !item.danger).map((item) => ({
      id: item.id,
      label: `${item.label} (${item.command})`,
      disabled: busy,
      onSelect: () => {
        requestOrRun(item.id);
      },
    }));
  }, [busy, requestOrRun]);

  const openPageContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      openContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: menuItems(),
      });
    },
    [menuItems, openContextMenu],
  );

  return (
    <section
      className="explorer docker-page"
      onContextMenu={openPageContextMenu}
    >
      <PageToolbar>
        <p className="page-toolbar__hint">
          Docker 디스크 사용량, 정보, 정리(prune) 작업을 실행합니다.
        </p>
      </PageToolbar>

      <div className="docker-placeholder docker-placeholder--system">
        <h2 className="docker-placeholder__title">시스템</h2>
        <p className="docker-placeholder__desc">
          정리(prune)는 아래 버튼으로 실행하고, 조회 명령은 우클릭 메뉴에서도
          실행할 수 있습니다.
          {busy ? " 명령 실행 중…" : null}
        </p>

        <ul className="docker-placeholder__commands docker-placeholder__actions">
          {SYSTEM_COMMANDS.map((item) => (
            <li key={item.id} className="docker-placeholder__action">
              <div className="docker-placeholder__action-body">
                <code>{item.command}</code>
                <p>{item.description}</p>
              </div>
              {item.danger ? (
                <DangerButton
                  type="button"
                  disabled={busy}
                  onClick={() => requestOrRun(item.id)}
                >
                  {item.label}
                </DangerButton>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => requestOrRun(item.id)}
                >
                  {item.label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {confirmDialog}
    </section>
  );
}
