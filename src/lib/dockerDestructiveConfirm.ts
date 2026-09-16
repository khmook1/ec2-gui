import type {
  DestructiveConfirmRequest,
} from "@/hooks/useDestructiveConfirm";
import type { DockerContainerAction } from "@/types/docker";

export type DockerDestructiveAction = Extract<
  DockerContainerAction,
  "kill" | "remove" | "force-remove"
>;

export function getDockerDestructiveConfirmMeta(
  action: DockerDestructiveAction,
): Pick<
  DestructiveConfirmRequest,
  "title" | "actionName" | "confirmButtonLabel"
> {
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
