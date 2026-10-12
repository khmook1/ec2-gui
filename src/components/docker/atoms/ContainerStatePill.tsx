import type { DockerContainerState } from "@/types/docker";
import "../css/docker-state.css";

const STATE_LABEL: Record<DockerContainerState, string> = {
  running: "실행 중",
  restarting: "재시작 중",
  paused: "일시정지",
  stopped: "중지됨",
  unknown: "알 수 없음",
};

interface ContainerStatePillProps {
  state: DockerContainerState;
  className?: string;
}

export function ContainerStatePill({
  state,
  className,
}: ContainerStatePillProps) {
  return (
    <span
      className={[
        "docker-state-pill",
        `docker-state-pill--${state}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="docker-state-pill__dot" aria-hidden />
      {STATE_LABEL[state]}
    </span>
  );
}
