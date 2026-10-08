import { useGitHubStore } from "@/stores/githubStore";
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
  | { type: "approvalRequired"; id: number; commands: AiApprovalCommand[] };

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
