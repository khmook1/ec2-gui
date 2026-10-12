import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AiCommandBar } from "@/components/ai/AiCommandBar";
import { AiSpeechBubble } from "@/components/ai/AiSpeechBubble";
import {
  useCancelAiChatMutation,
  useRespondAiCommandApprovalMutation,
  useRespondAiSudoPasswordMutation,
  useSendAiChatMutation,
} from "@/hooks/query";
import { useQueryClient } from "@tanstack/react-query";
import { AI_CHAT_CANCELLED, type AiChatMessage } from "@/services/tauri/ai";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AiExchange } from "@/types/ai";
import "./css/ai-chatbot.css";

interface AiChatbotContextValue {
  /** AI 설정이 있어 캐릭터·입력창을 쓸 수 있는지 */
  enabled: boolean;
  commandOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;
  ask: (question: string) => void;
}

const AiChatbotContext = createContext<AiChatbotContextValue | null>(null);

const ICON_SWAP_MS = 3200;

const AI_COMMAND_SHORTCUT_LABEL = "⇧ Space";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isCommandShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "Space" || !event.shiftKey || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return false;
  // 입력 중 Shift+Space(대문자 뒤 공백 등)를 가로채지 않는다. 터미널(xterm)도 textarea라 제외된다.
  return !isEditableTarget(event.target);
}

function AiChatbotToggle({
  busy,
  onToggle,
}: {
  busy: boolean;
  onToggle: () => void;
}) {
  const [showActiveIcon, setShowActiveIcon] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShowActiveIcon((current) => !current);
    }, ICON_SWAP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return createPortal(
    <button
      type="button"
      className={[
        "ai-chatbot-toggle",
        busy ? "ai-chatbot-toggle--busy" : "",
        showActiveIcon || busy ? "ai-chatbot-toggle--alt" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`AI에게 질문하기 (${AI_COMMAND_SHORTCUT_LABEL})`}
      title={`AI에게 질문하기 (${AI_COMMAND_SHORTCUT_LABEL})`}
      onClick={onToggle}
    >
      <span className="ai-chatbot-toggle__icons" aria-hidden>
        <img
          className="ai-chatbot-toggle__icon ai-chatbot-toggle__icon--idle"
          src="/ai-icon2.png"
          alt=""
          draggable={false}
        />
        <img
          className="ai-chatbot-toggle__icon ai-chatbot-toggle__icon--active"
          src="/ai-icon1.png"
          alt=""
          draggable={false}
        />
      </span>
    </button>,
    document.body,
  );
}

export function AiChatbotProvider({ children }: { children: ReactNode }) {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const ai = useSettingsStore((state) => state.ai);
  const enabled = hydrated && ai.provider !== null;

  const [commandOpen, setCommandOpen] = useState(false);
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [exchange, setExchange] = useState<AiExchange | null>(null);
  const requestIdRef = useRef(0);
  const partialAnswerRef = useRef("");
  const sendMutation = useSendAiChatMutation();
  const cancelMutation = useCancelAiChatMutation();
  const approvalMutation = useRespondAiCommandApprovalMutation();
  const sudoPasswordMutation = useRespondAiSudoPasswordMutation();
  const queryClient = useQueryClient();

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);
  const toggleCommand = useCallback(() => setCommandOpen((current) => !current), []);

  const updateExchange = useCallback(
    (requestId: number, patch: (current: AiExchange) => AiExchange) => {
      if (requestId !== requestIdRef.current) return;
      setExchange((current) => (current ? patch(current) : current));
    },
    [],
  );

  const cancel = useCallback(() => {
    if (!exchange?.pending) return;
    cancelMutation.mutate();
  }, [cancelMutation, exchange?.pending]);

  const respondApproval = useCallback(
    (approved: boolean) => {
      const approval = exchange?.approval;
      if (!exchange || !approval) return;
      approvalMutation.mutate({ id: approval.id, approved });
      updateExchange(exchange.id, (current) => ({ ...current, approval: null }));
    },
    [approvalMutation, exchange, updateExchange],
  );

  const respondSudoPassword = useCallback(
    (password: string | null) => {
      const prompt = exchange?.sudoPrompt;
      if (!exchange || !prompt) return;
      sudoPasswordMutation.mutate({ id: prompt.id, password });
      updateExchange(exchange.id, (current) => ({ ...current, sudoPrompt: null }));
    },
    [sudoPasswordMutation, exchange, updateExchange],
  );

  const ask = useCallback(
    (input: string) => {
      const question = input.trim();
      if (!question || !ai.provider) return;

      const requestId = ++requestIdRef.current;
      partialAnswerRef.current = "";
      const messages: AiChatMessage[] = [
        ...history,
        { role: "user", content: question },
      ];
      setExchange({
        id: requestId,
        question,
        answer: "",
        status: null,
        error: null,
        pending: true,
        cancelled: false,
        approval: null,
        sudoPrompt: null,
      });

      sendMutation
        .mutateAsync({
          connection: { provider: ai.provider, binaryPath: ai.binaryPath },
          messages,
          onEvent: (event) => {
            if (requestId !== requestIdRef.current) return;
            switch (event.type) {
              case "delta":
                partialAnswerRef.current += event.text;
                updateExchange(requestId, (current) => ({
                  ...current,
                  answer: current.answer + event.text,
                  status: null,
                  approval: null,
                  sudoPrompt: null,
                }));
                break;
              case "status":
                updateExchange(requestId, (current) => ({
                  ...current,
                  status: event.text,
                  approval: null,
                  sudoPrompt: null,
                }));
                break;
              case "reset":
                partialAnswerRef.current = "";
                updateExchange(requestId, (current) => ({ ...current, answer: "" }));
                break;
              case "approvalRequired":
                updateExchange(requestId, (current) => ({
                  ...current,
                  approval: { id: event.id, commands: event.commands },
                }));
                break;
              case "sudoPasswordRequired":
                updateExchange(requestId, (current) => ({
                  ...current,
                  sudoPrompt: { id: event.id, path: event.path },
                }));
                break;
              case "fileChanged":
                void queryClient.invalidateQueries({ queryKey: ["fs"] });
                break;
            }
          },
        })
        .then((reply) => {
          if (requestId !== requestIdRef.current) return;
          setHistory((current) => [
            ...current,
            { role: "user", content: question },
            { role: "assistant", content: reply },
          ]);
          updateExchange(requestId, (current) => ({
            ...current,
            answer: reply,
            status: null,
            pending: false,
            approval: null,
            sudoPrompt: null,
          }));
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          const message = err instanceof Error ? err.message : String(err);
          const cancelled = message === AI_CHAT_CANCELLED;
          const partial = partialAnswerRef.current.trim();
          if (cancelled && partial) {
            setHistory((current) => [
              ...current,
              { role: "user", content: question },
              { role: "assistant", content: partial },
            ]);
          }
          updateExchange(requestId, (current) => ({
            ...current,
            status: null,
            pending: false,
            cancelled,
            approval: null,
            sudoPrompt: null,
            error: cancelled ? null : message,
          }));
        });
    },
    [ai.provider, ai.binaryPath, history, sendMutation, updateExchange, queryClient],
  );

  const dismiss = useCallback(() => {
    cancel();
    requestIdRef.current += 1;
    setExchange(null);
  }, [cancel]);

  const resetConversation = useCallback(() => {
    cancel();
    requestIdRef.current += 1;
    setHistory([]);
    setExchange(null);
    setCommandOpen(true);
  }, [cancel]);

  useEffect(() => {
    if (!enabled) {
      setCommandOpen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!isCommandShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setCommandOpen((current) => !current);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled]);

  const value = useMemo<AiChatbotContextValue>(
    () => ({ enabled, commandOpen, openCommand, closeCommand, toggleCommand, ask }),
    [enabled, commandOpen, openCommand, closeCommand, toggleCommand, ask],
  );

  return (
    <AiChatbotContext.Provider value={value}>
      {children}
      {enabled && ai.provider ? (
        <>
          {exchange ? (
            <AiSpeechBubble
              key={exchange.id}
              exchange={exchange}
              canReset={history.length > 0}
              onCancel={cancel}
              onApprove={() => respondApproval(true)}
              onReject={() => respondApproval(false)}
              onSudoPassword={respondSudoPassword}
              onDismiss={dismiss}
              onReset={resetConversation}
            />
          ) : null}
          <AiChatbotToggle busy={exchange?.pending ?? false} onToggle={toggleCommand} />
          {commandOpen ? (
            <AiCommandBar
              provider={ai.provider}
              shortcutLabel={AI_COMMAND_SHORTCUT_LABEL}
              pending={exchange?.pending ?? false}
              onSubmit={(question) => {
                ask(question);
                closeCommand();
              }}
              onClose={closeCommand}
            />
          ) : null}
        </>
      ) : null}
    </AiChatbotContext.Provider>
  );
}

export function useAiChatbot(): AiChatbotContextValue {
  const context = useContext(AiChatbotContext);
  if (!context) {
    throw new Error("useAiChatbot must be used within AiChatbotProvider");
  }
  return context;
}
