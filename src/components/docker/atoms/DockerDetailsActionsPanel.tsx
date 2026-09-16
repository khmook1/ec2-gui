import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/common/Button";
import { DangerButton } from "@/components/common/DangerButton";
import { DockerDetailsActionGroup } from "@/components/docker/atoms/DockerDetailsActionGroup";
import type { DockerDestructiveAction } from "@/lib/dockerDestructiveConfirm";
import type { DockerContainerAction } from "@/types/docker";

interface DockerDetailsActionsPanelProps {
  containerId: string;
  statusText: string;
  isActing: boolean;
  isStartable: boolean;
  isActive: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isNginx: boolean;
  onAction: (action: DockerContainerAction) => void;
  onDestructive: (action: DockerDestructiveAction) => void;
}

function actionCommand(containerId: string, action: string): string {
  const id = containerId.trim() || "<container>";
  switch (action) {
    case "start":
      return `docker start -- ${id}`;
    case "stop":
      return `docker stop -- ${id}`;
    case "restart":
      return `docker restart -- ${id}`;
    case "kill":
      return `docker kill -- ${id}`;
    case "pause":
      return `docker pause -- ${id}`;
    case "unpause":
      return `docker unpause -- ${id}`;
    case "remove":
      return `docker rm -- ${id}`;
    case "force-remove":
      return `docker rm -f -- ${id}`;
    case "nginx-test":
      return `docker exec -- ${id} nginx -t`;
    case "nginx-reload":
      return `docker exec -- ${id} nginx -s reload`;
    case "nginx-version":
      return `docker exec -- ${id} nginx -v`;
    case "nginx-quit":
      return `docker exec -- ${id} nginx -s quit`;
    default:
      return action;
  }
}

function CommandTooltip({
  command,
  children,
}: {
  command: string;
  children: ReactElement;
}) {
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const updatePos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const show = useCallback(() => {
    updatePos();
    setVisible(true);
  }, [updatePos]);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    hide();
  }

  useEffect(() => {
    if (!visible) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [visible, updatePos]);

  return (
    <span
      ref={wrapRef}
      className="docker-details__action-tip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={handleBlur}
    >
      {children}
      {createPortal(
        <span
          id={tooltipId}
          className={[
            "icon-btn-tooltip",
            "icon-btn-tooltip--fixed",
            "icon-btn-tooltip--command",
            visible ? "icon-btn-tooltip--visible" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
        >
          {command}
        </span>,
        document.body,
      )}
    </span>
  );
}

export function DockerDetailsActionsPanel({
  containerId,
  statusText,
  isActing,
  isStartable,
  isActive,
  isRunning,
  isPaused,
  isNginx,
  onAction,
  onDestructive,
}: DockerDetailsActionsPanelProps) {
  const cmd = (action: string) => actionCommand(containerId, action);

  return (
    <div className="docker-details__actions">
      {statusText ? (
        <p className="docker-details__actions-status">
          상태: <strong>{statusText}</strong>
        </p>
      ) : null}

      <DockerDetailsActionGroup
        title="수명주기"
        description="컨테이너를 시작·중지·재시작합니다. 중지하면 프로세스가 종료되고 포트·서비스가 내려가며, 강제 종료는 즉시 프로세스를 끊습니다."
      >
        <CommandTooltip command={cmd("start")}>
          <Button
            variant="ghost"
            disabled={isActing || !isStartable}
            onClick={() => onAction("start")}
          >
            시작
          </Button>
        </CommandTooltip>
        <CommandTooltip command={cmd("stop")}>
          <Button
            variant="ghost"
            disabled={isActing || !isActive}
            onClick={() => onAction("stop")}
          >
            중지
          </Button>
        </CommandTooltip>
        <CommandTooltip command={cmd("restart")}>
          <Button
            variant="ghost"
            disabled={isActing}
            onClick={() => onAction("restart")}
          >
            재시작
          </Button>
        </CommandTooltip>
        <CommandTooltip command={cmd("kill")}>
          <DangerButton
            disabled={isActing || !isActive}
            onClick={() => onDestructive("kill")}
          >
            강제 종료
          </DangerButton>
        </CommandTooltip>
      </DockerDetailsActionGroup>

      <DockerDetailsActionGroup
        title="일시정지"
        description="실행 중인 프로세스를 잠시 멈추거나 다시 이어갑니다. 컨테이너는 유지되지만 CPU·네트워크 활동이 중단됩니다."
      >
        <CommandTooltip command={cmd("pause")}>
          <Button
            variant="ghost"
            disabled={isActing || !isRunning}
            onClick={() => onAction("pause")}
          >
            일시정지
          </Button>
        </CommandTooltip>
        <CommandTooltip command={cmd("unpause")}>
          <Button
            variant="ghost"
            disabled={isActing || !isPaused}
            onClick={() => onAction("unpause")}
          >
            재개
          </Button>
        </CommandTooltip>
      </DockerDetailsActionGroup>

      {isNginx ? (
        <DockerDetailsActionGroup
          title="nginx"
          description="컨테이너 안에서 nginx 명령을 실행합니다. 설정 검사·리로드는 서비스 중단 없이 반영하고, 정상 종료는 nginx만 부드럽게 내립니다."
        >
          <CommandTooltip command={cmd("nginx-test")}>
            <Button
              variant="ghost"
              disabled={isActing || !isRunning}
              onClick={() => onAction("nginx-test")}
            >
              설정 검사 (-t)
            </Button>
          </CommandTooltip>
          <CommandTooltip command={cmd("nginx-reload")}>
            <Button
              variant="ghost"
              disabled={isActing || !isRunning}
              onClick={() => onAction("nginx-reload")}
            >
              리로드
            </Button>
          </CommandTooltip>
          <CommandTooltip command={cmd("nginx-version")}>
            <Button
              variant="ghost"
              disabled={isActing || !isRunning}
              onClick={() => onAction("nginx-version")}
            >
              버전
            </Button>
          </CommandTooltip>
          <CommandTooltip command={cmd("nginx-quit")}>
            <Button
              variant="ghost"
              disabled={isActing || !isRunning}
              onClick={() => onAction("nginx-quit")}
            >
              정상 종료 (-s quit)
            </Button>
          </CommandTooltip>
        </DockerDetailsActionGroup>
      ) : null}

      <DockerDetailsActionGroup
        title="삭제"
        description="컨테이너를 목록에서 제거합니다. 삭제된 컨테이너는 다시 만들 때까지 사용할 수 없으며, 강제 삭제는 실행 중이어도 바로 지웁니다."
      >
        <CommandTooltip command={cmd("remove")}>
          <DangerButton
            disabled={isActing || isActive}
            onClick={() => onDestructive("remove")}
          >
            삭제
          </DangerButton>
        </CommandTooltip>
        <CommandTooltip command={cmd("force-remove")}>
          <DangerButton
            disabled={isActing}
            onClick={() => onDestructive("force-remove")}
          >
            강제 삭제
          </DangerButton>
        </CommandTooltip>
      </DockerDetailsActionGroup>
    </div>
  );
}
