import { ROUTE_ID } from "@/config/Route";
import { useExplorerContextStore } from "@/stores/explorerContextStore";
import { useGitHubStore } from "@/stores/githubStore";
import { useNavStore } from "@/stores/navStore";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { AiApprovalCommand } from "@/types/ai";
import type { AiProvider } from "@/types/settings";

export interface AiCliStatus {
  path: string;
  version: string;
}

export type AiChatRole = "user" | "assistant";

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiConnectionInput {
  provider: AiProvider;
  binaryPath: string | null;
}

export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "reset" }
  | { type: "approvalRequired"; id: number; commands: AiApprovalCommand[] }
  | { type: "sudoPasswordRequired"; id: number; path: string }
  | { type: "fileChanged"; path: string };

/** 백엔드가 취소된 요청에 돌려주는 고정 메시지 */
export const AI_CHAT_CANCELLED = "AI_CHAT_CANCELLED";

export async function checkAiCli({
  provider,
  binaryPath,
}: AiConnectionInput): Promise<AiCliStatus> {
  return invoke<AiCliStatus>("check_ai_cli", { provider, binaryPath });
}

export async function sendAiChat(
  { provider, binaryPath }: AiConnectionInput,
  messages: AiChatMessage[],
  onEvent: (event: AiStreamEvent) => void,
): Promise<string> {
  const channel = new Channel<AiStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<string>("send_ai_chat", {
    provider,
    binaryPath,
    messages,
    githubRepo: useGitHubStore.getState().selectedRepo,
    explorer:
      useNavStore.getState().activeId === ROUTE_ID.fileExplorer
        ? useExplorerContextStore.getState().context
        : null,
    onEvent: channel,
  });
}

export async function cancelAiChat(): Promise<void> {
  return invoke("cancel_ai_chat");
}

export async function respondAiCommandApproval(
  id: number,
  approved: boolean,
): Promise<void> {
  return invoke("respond_ai_command_approval", { id, approved });
}

/** `password`가 null이면 입력 취소 */
export async function respondAiSudoPassword(
  id: number,
  password: string | null,
): Promise<void> {
  return invoke("respond_ai_sudo_password", { id, password });
}
