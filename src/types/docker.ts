export interface DockerContainer {
  id: string;
  image: string;
  status: string;
  names: string;
  ports: string;
}

export interface DockerContainerDetails {
  id: string;
  name: string;
  image: string;
  status: string;
  created: string;
  platform: string;
  restartPolicy: string;
  ipAddress: string;
  macAddress: string;
  networks: string;
  mounts: string;
  env: string;
  cmd: string;
  entrypoint: string;
  workingDir: string;
  ports: string;
  labels: string;
  stats: string | null;
  top: string | null;
  logs: string | null;
  inspectJson: string;
}

export type DockerContainerAction =
  | "start"
  | "stop"
  | "restart"
  | "kill"
  | "pause"
  | "unpause"
  | "remove"
  | "force-remove"
  | "nginx-test"
  | "nginx-reload"
  | "nginx-quit"
  | "nginx-version";

export type DockerContainerState =
  | "running"
  | "paused"
  | "stopped"
  | "unknown";

export function getDockerContainerState(
  status: string,
): DockerContainerState {
  const normalized = status.toLowerCase().trim();
  if (!normalized) {
    return "unknown";
  }

  // docker ps: "Up 2 hours (Paused)" / inspect State.Status: "paused"
  if (normalized.includes("(paused)") || normalized === "paused") {
    return "paused";
  }

  // docker ps: "Up …" / inspect: "running", "restarting"
  if (
    normalized.startsWith("up") ||
    normalized.startsWith("running") ||
    normalized.startsWith("restarting")
  ) {
    return "running";
  }

  // docker ps: "Exited …" / inspect: "exited", "created", "dead", …
  if (
    normalized.startsWith("exited") ||
    normalized.startsWith("created") ||
    normalized.startsWith("dead") ||
    normalized.startsWith("removing") ||
    normalized.startsWith("removed")
  ) {
    return "stopped";
  }

  return "unknown";
}

/** 실행 중이거나 일시정지된 컨테이너(중지·kill 등에 사용) */
export function isDockerContainerActive(state: DockerContainerState): boolean {
  return state === "running" || state === "paused";
}

/** 이름·이미지에 nginx(또는 오타 ngnix)가 포함된 컨테이너인지 판별 */
export function isNginxContainer(container: DockerContainer): boolean {
  const haystack = `${container.names} ${container.image}`.toLowerCase();
  return haystack.includes("nginx") || haystack.includes("ngnix");
}
