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
import { AiConversationList } from "@/components/ai/AiConversationList";
import { AiSpeechBubble } from "@/components/ai/AiSpeechBubble";
import {
  queryKeys,
  useAiConversationQuery,
  useCancelAiChatMutation,
  useRespondAiCommandApprovalMutation,
  useRespondAiSudoPasswordMutation,
  useSendAiChatMutation,
} from "@/hooks/query";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadActiveConversationId,
  saveActiveConversationId,
} from "@/lib/aiChatPersistence";
import { AI_CHAT_CANCELLED, getAiConversation } from "@/services/tauri/ai";
import { useSettingsStore } from "@/stores/settingsStore";
import type { AiConversation, AiExchange } from "@/types/ai";
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
  const [listOpen, setListOpen] = useState(false);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [exchange, setExchange] = useState<AiExchange | null>(null);
  const conversationQuery = useAiConversationQuery(activeConversationId);
  const conversation = conversationQuery.data ?? null;
  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);
  const requestIdRef = useRef(0);
  const sendMutation = useSendAiChatMutation();
  const cancelMutation = useCancelAiChatMutation();
  const approvalMutation = useRespondAiCommandApprovalMutation();
  const sudoPasswordMutation = useRespondAiSudoPasswordMutation();
  const queryClient = useQueryClient();

  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdState(id);
    void saveActiveConversationId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadActiveConversationId().then((id) => {
      if (!cancelled && id) setActiveConversationIdState(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 저장된 대화 파일이 사라졌으면 새 대화로 시작한다.
  useEffect(() => {
    if (activeConversationId && conversationQuery.isSuccess && conversationQuery.data === null) {
      setActiveConversationId(null);
    }
  }, [activeConversationId, conversationQuery.isSuccess, conversationQuery.data, setActiveConversationId]);

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
      const conversationId = activeConversationId ?? crypto.randomUUID();
      if (!activeConversationId) setActiveConversationId(conversationId);
      const refreshConversation = () =>
        void queryClient.invalidateQueries({
          queryKey: queryKeys.aiConversation(conversationId),
        });
      setExchange({
        id: requestId,
        historyCount: activeConversationId ? messages.length : 0,
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
          input: { conversationId, question },
          onEvent: (event) => {
            if (requestId !== requestIdRef.current) return;
            switch (event.type) {
              case "delta":
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
        .then(({ reply }) => {
          refreshConversation();
          if (requestId !== requestIdRef.current) return;
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
          // 취소된 요청도 부분 답변이 저장됐을 수 있다.
          refreshConversation();
          if (requestId !== requestIdRef.current) return;
          const message = err instanceof Error ? err.message : String(err);
          const cancelled = message === AI_CHAT_CANCELLED;
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
    [
      ai.provider,
      ai.binaryPath,
      activeConversationId,
      messages.length,
      setActiveConversationId,
      sendMutation,
      updateExchange,
      queryClient,
    ],
  );

  const dismiss = useCallback(() => {
    cancel();
    requestIdRef.current += 1;
    setExchange(null);
  }, [cancel]);

  const resetConversation = useCallback(() => {
    cancel();
    requestIdRef.current += 1;
    setActiveConversationId(null);
    setExchange(null);
    setListOpen(false);
    setCommandOpen(true);
  }, [cancel, setActiveConversationId]);

  const openList = useCallback(() => {
    setCommandOpen(false);
    setListOpen(true);
  }, []);

  /** 저장된 대화를 열어 마지막 질문·답변을 말풍선에 보여 준다. */
  const selectConversation = useCallback(
    async (id: string) => {
      cancel();
      const requestId = ++requestIdRef.current;
      setListOpen(false);
      setActiveConversationId(id);
      let loaded: AiConversation | null;
      try {
        loaded = await queryClient.fetchQuery({
          queryKey: queryKeys.aiConversation(id),
          queryFn: () => getAiConversation(id),
        });
      } catch {
        loaded = null;
      }
      if (requestId !== requestIdRef.current) return;
      const stored = loaded?.messages ?? [];
      const question = stored[stored.length - 2];
      const answer = stored[stored.length - 1];
      if (question?.role !== "user" || answer?.role !== "assistant") {
        setExchange(null);
        setCommandOpen(true);
        return;
      }
      setExchange({
        id: requestId,
        historyCount: stored.length - 2,
        question: question.content,
        answer: answer.content,
        status: null,
        error: null,
        pending: false,
        cancelled: false,
        approval: null,
        sudoPrompt: null,
      });
    },
    [cancel, queryClient, setActiveConversationId],
  );

  const handleConversationDeleted = useCallback(
    (id: string) => {
      if (id !== activeConversationId) return;
      requestIdRef.current += 1;
      setActiveConversationId(null);
      setExchange(null);
    },
    [activeConversationId, setActiveConversationId],
  );

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
          {listOpen ? (
            <AiConversationList
              activeId={activeConversationId}
              onSelect={(id) => void selectConversation(id)}
              onDeleted={handleConversationDeleted}
              onNewConversation={resetConversation}
              onClose={() => setListOpen(false)}
            />
          ) : exchange ? (
            <AiSpeechBubble
              key={exchange.id}
              exchange={exchange}
              history={messages.slice(0, exchange.historyCount)}
              canReset={activeConversationId !== null}
              onCancel={cancel}
              onApprove={() => respondApproval(true)}
              onReject={() => respondApproval(false)}
              onSudoPassword={respondSudoPassword}
              onDismiss={dismiss}
              onReset={resetConversation}
              onOpenList={openList}
            />
          ) : null}
          <AiChatbotToggle busy={exchange?.pending ?? false} onToggle={toggleCommand} />
          {commandOpen ? (
            <AiCommandBar
              provider={ai.provider}
              shortcutLabel={AI_COMMAND_SHORTCUT_LABEL}
              pending={exchange?.pending ?? false}
              conversationTitle={activeConversationId ? (conversation?.title ?? null) : null}
              onSubmit={(question) => {
                setListOpen(false);
                ask(question);
                closeCommand();
              }}
              onClose={closeCommand}
              onOpenList={openList}
              onNewConversation={resetConversation}
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
