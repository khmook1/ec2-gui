import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelAiChat,
  checkAiCli,
  respondAiCommandApproval,
  respondAiSudoPassword,
  sendAiChat,
  type AiChatMessage,
  type AiConnectionInput,
  type AiStreamEvent,
} from "@/services/tauri/ai";

export function useCheckAiCliMutation() {
  return useMutation({
    mutationFn: (input: AiConnectionInput) => checkAiCli(input),
  });
}

export function useSendAiChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    onSettled: () => {
      // 승인된 변경은 취소/오류 전에 이미 실행되었을 수도 있다.
      void queryClient.invalidateQueries({ queryKey: ["github"] });
      void queryClient.invalidateQueries({ queryKey: ["fs"] });
    },
    mutationFn: ({
      connection,
      messages,
      onEvent,
    }: {
      connection: AiConnectionInput;
      messages: AiChatMessage[];
      onEvent: (event: AiStreamEvent) => void;
    }) => sendAiChat(connection, messages, onEvent),
  });
}

export function useCancelAiChatMutation() {
  return useMutation({
    mutationFn: cancelAiChat,
  });
}

export function useRespondAiSudoPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string | null }) =>
      respondAiSudoPassword(id, password),
  });
}

export function useRespondAiCommandApprovalMutation() {
  return useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      respondAiCommandApproval(id, approved),
  });
}
