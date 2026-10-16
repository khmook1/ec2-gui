import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelAiChat,
  checkAiCli,
  deleteAiConversation,
  getAiConversation,
  listAiConversations,
  listAiSkills,
  respondAiCommandApproval,
  respondAiSudoPassword,
  sendAiChat,
  type AiChatInput,
  type AiConnectionInput,
  type AiStreamEvent,
} from "@/services/tauri/ai";
import { queryKeys } from "./keys";

export function useCheckAiCliMutation() {
  return useMutation({
    mutationFn: (input: AiConnectionInput) => checkAiCli(input),
  });
}

export function useAiSkillsQuery() {
  return useQuery({
    queryKey: queryKeys.aiSkills,
    queryFn: listAiSkills,
    staleTime: Infinity,
  });
}

export function useAiConversationsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiConversations,
    queryFn: listAiConversations,
    enabled,
  });
}

export function useAiConversationQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.aiConversation(id ?? ""),
    queryFn: () => getAiConversation(id ?? ""),
    enabled: id !== null,
  });
}

export function useDeleteAiConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAiConversation(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.aiConversation(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConversations });
    },
  });
}

export function useSendAiChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    onSettled: () => {
      // 승인된 변경은 취소/오류 전에 이미 실행되었을 수도 있다.
      void queryClient.invalidateQueries({ queryKey: ["github"] });
      void queryClient.invalidateQueries({ queryKey: ["fs"] });
      // 취소돼도 부분 답변이 저장될 수 있다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiConversations });
    },
    mutationFn: ({
      connection,
      input,
      onEvent,
    }: {
      connection: AiConnectionInput;
      input: AiChatInput;
      onEvent: (event: AiStreamEvent) => void;
    }) => sendAiChat(connection, input, onEvent),
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
