import { invoke } from "@tauri-apps/api/core";
import type {
  DockerContainer,
  DockerContainerAction,
  DockerContainerDetails,
  DockerImage,
  DockerImageAction,
  DockerNetwork,
  DockerNetworkAction,
  DockerOverview,
  DockerSystemAction,
  DockerVolume,
  DockerVolumeAction,
} from "@/types/docker";

export function checkRemoteDocker(): Promise<boolean> {
  return invoke<boolean>("check_remote_docker");
}

export function listRemoteDockerContainers(): Promise<DockerContainer[]> {
  return invoke<DockerContainer[]>("list_remote_docker_containers");
}

export function listRemoteDockerImages(): Promise<DockerImage[]> {
  return invoke<DockerImage[]>("list_remote_docker_images");
}

export function listRemoteDockerNetworks(): Promise<DockerNetwork[]> {
  return invoke<DockerNetwork[]>("list_remote_docker_networks");
}

export function listRemoteDockerVolumes(): Promise<DockerVolume[]> {
  return invoke<DockerVolume[]>("list_remote_docker_volumes");
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

export function runRemoteDockerImageAction(
  imageRef: string,
  action: DockerImageAction,
): Promise<string> {
  return invoke<string>("run_remote_docker_image_action", {
    imageRef,
    action,
  });
}

export function runRemoteDockerVolumeAction(
  volumeName: string,
  action: DockerVolumeAction,
): Promise<string> {
  return invoke<string>("run_remote_docker_volume_action", {
    volumeName,
    action,
  });
}

export function runRemoteDockerNetworkAction(
  networkRef: string,
  action: DockerNetworkAction,
): Promise<string> {
  return invoke<string>("run_remote_docker_network_action", {
    networkRef,
    action,
  });
}

export function runRemoteDockerSystemAction(
  action: DockerSystemAction,
): Promise<string> {
  return invoke<string>("run_remote_docker_system_action", {
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

export function getRemoteDockerOverview(): Promise<DockerOverview> {
  return invoke<DockerOverview>("get_remote_docker_overview");
}
