import { useMutation } from "@tanstack/react-query";
import {
  cancelAiChat,
  checkAiCli,
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
  return useMutation({
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
