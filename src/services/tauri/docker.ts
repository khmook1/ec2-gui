import { invoke } from "@tauri-apps/api/core";
import type {
  DockerContainer,
  DockerContainerAction,
  DockerContainerDetails,
} from "@/types/docker";

export function checkRemoteDocker(): Promise<boolean> {
  return invoke<boolean>("check_remote_docker");
}

export function listRemoteDockerContainers(): Promise<DockerContainer[]> {
  return invoke<DockerContainer[]>("list_remote_docker_containers");
}

export function runRemoteDockerContainerAction(
  containerId: string,
  action: DockerContainerAction,
): Promise<string> {
  return invoke<string>("run_remote_docker_container_action", {
    containerId,
    action,
  });
}

export function getRemoteDockerContainerDetails(
  containerId: string,
): Promise<DockerContainerDetails> {
  return invoke<DockerContainerDetails>("get_remote_docker_container_details", {
    containerId,
  });
}

export function getRemoteDockerContainerLogs(
  containerId: string,
  options?: { tail?: number; since?: string },
): Promise<string> {
  return invoke<string>("get_remote_docker_container_logs", {
    containerId,
    tail: options?.tail ?? 200,
    since: options?.since?.trim() ? options.since.trim() : null,
  });
}
