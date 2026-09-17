import type {
  DestructiveConfirmRequest,
} from "@/hooks/useDestructiveConfirm";
import type {
  DockerContainerAction,
  DockerImageAction,
  DockerNetworkAction,
  DockerSystemAction,
  DockerVolumeAction,
} from "@/types/docker";

export type DockerDestructiveAction = Extract<
  DockerContainerAction,
  "kill" | "remove" | "force-remove"
>;

export type DockerImageDestructiveAction = Extract<
  DockerImageAction,
  "remove" | "force-remove" | "prune"
>;

export type DockerVolumeDestructiveAction = Extract<
  DockerVolumeAction,
  "remove" | "force-remove" | "prune"
>;

export type DockerNetworkDestructiveAction = Extract<
  DockerNetworkAction,
  "remove" | "force-remove" | "prune"
>;

export type DockerSystemDestructiveAction = Extract<
  DockerSystemAction,
  "prune" | "prune-all" | "prune-volumes"
>;

type ConfirmMeta = Pick<
  DestructiveConfirmRequest,
  "title" | "actionName" | "confirmButtonLabel"
>;

export function getDockerDestructiveConfirmMeta(
  action: DockerDestructiveAction,
): ConfirmMeta {
  switch (action) {
    case "kill":
      return {
        title: "강제 종료 확인",
        actionName: "강제 종료",
        confirmButtonLabel: "강제 종료",
      };
    case "force-remove":
      return {
        title: "강제 삭제 확인",
        actionName: "강제 삭제",
        confirmButtonLabel: "강제 삭제",
      };
    case "remove":
    default:
      return {
        title: "삭제 확인",
        actionName: "삭제",
        confirmButtonLabel: "삭제",
      };
  }
}

export function getDockerImageDestructiveConfirmMeta(
  action: DockerImageDestructiveAction,
): ConfirmMeta {
  switch (action) {
    case "force-remove":
      return {
        title: "이미지 강제 삭제 확인",
        actionName: "강제 삭제",
        confirmButtonLabel: "강제 삭제",
      };
    case "prune":
      return {
        title: "미사용 이미지 정리 확인",
        actionName: "정리",
        confirmButtonLabel: "정리",
      };
    case "remove":
    default:
      return {
        title: "이미지 삭제 확인",
        actionName: "삭제",
        confirmButtonLabel: "삭제",
      };
  }
}

export function getDockerVolumeDestructiveConfirmMeta(
  action: DockerVolumeDestructiveAction,
): ConfirmMeta {
  switch (action) {
    case "force-remove":
      return {
        title: "볼륨 강제 삭제 확인",
        actionName: "강제 삭제",
        confirmButtonLabel: "강제 삭제",
      };
    case "prune":
      return {
        title: "미사용 볼륨 정리 확인",
        actionName: "정리",
        confirmButtonLabel: "정리",
      };
    case "remove":
    default:
      return {
        title: "볼륨 삭제 확인",
        actionName: "삭제",
        confirmButtonLabel: "삭제",
      };
  }
}

export function getDockerNetworkDestructiveConfirmMeta(
  action: DockerNetworkDestructiveAction,
): ConfirmMeta {
  switch (action) {
    case "force-remove":
      return {
        title: "네트워크 강제 삭제 확인",
        actionName: "강제 삭제",
        confirmButtonLabel: "강제 삭제",
      };
    case "prune":
      return {
        title: "미사용 네트워크 정리 확인",
        actionName: "정리",
        confirmButtonLabel: "정리",
      };
    case "remove":
    default:
      return {
        title: "네트워크 삭제 확인",
        actionName: "삭제",
        confirmButtonLabel: "삭제",
      };
  }
}

export function getDockerSystemDestructiveConfirmMeta(
  action: DockerSystemDestructiveAction,
): ConfirmMeta {
  switch (action) {
    case "prune-all":
      return {
        title: "시스템 전체 정리 확인",
        actionName: "전체 정리",
        confirmButtonLabel: "전체 정리",
      };
    case "prune-volumes":
      return {
        title: "볼륨 포함 시스템 정리 확인",
        actionName: "볼륨 포함 정리",
        confirmButtonLabel: "정리",
      };
    case "prune":
    default:
      return {
        title: "시스템 정리 확인",
        actionName: "정리",
        confirmButtonLabel: "정리",
      };
  }
}
