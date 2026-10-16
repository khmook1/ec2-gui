import { ROUTE_ID } from "@/config/Route";
import { useExplorerContextStore } from "@/stores/explorerContextStore";
import { useGitHubStore } from "@/stores/githubStore";
import { useNavStore } from "@/stores/navStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AiApprovalCommand,
  AiConversation,
  AiConversationSummary,
  AiSkill,
} from "@/types/ai";
import type { AiProvider } from "@/types/settings";

export interface AiCliStatus {
  path: string;
  version: string;
}

export interface AiChatInput {
  /** 새 대화면 프론트에서 만든 새 ID */
  conversationId: string;
  question: string;
}

export interface AiChatReply {
  conversationId: string;
  reply: string;
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
  { conversationId, question }: AiChatInput,
  onEvent: (event: AiStreamEvent) => void,
): Promise<AiChatReply> {
  const channel = new Channel<AiStreamEvent>();
  channel.onmessage = onEvent;
  const activePage = useNavStore.getState().activeId;
  return invoke<AiChatReply>("send_ai_chat", {
    provider,
    binaryPath,
    conversationId,
    question,
    githubRepo: useGitHubStore.getState().selectedRepo,
    explorer:
      activePage === ROUTE_ID.fileExplorer
        ? useExplorerContextStore.getState().context
        : null,
    activePage,
    aiIcon: useSettingsStore.getState().ai.icon,
    onEvent: channel,
  });
}

export async function listAiSkills(): Promise<AiSkill[]> {
  return invoke<AiSkill[]>("list_ai_skills");
}

export async function listAiConversations(): Promise<AiConversationSummary[]> {
  return invoke<AiConversationSummary[]>("list_ai_conversations");
}

/** 파일이 없으면 null */
export async function getAiConversation(id: string): Promise<AiConversation | null> {
  return invoke<AiConversation | null>("get_ai_conversation", { id });
}

export async function deleteAiConversation(id: string): Promise<void> {
  return invoke("delete_ai_conversation", { id });
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
