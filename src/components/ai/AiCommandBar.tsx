import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { AiProviderIcon } from "@/components/icons/AiProviderIcons";
import { getAiProviderLabel, type AiProvider } from "@/types/settings";
import "./css/ai-command-bar.css";

interface AiCommandFormValues {
  question: string;
}

interface AiCommandBarProps {
  provider: AiProvider;
  shortcutLabel: string;
  /** 이전 응답이 아직 생성 중인지 (새 질문 시 이전 응답은 중단된다) */
  pending: boolean;
  /** 이어서 질문할 대화 제목 (null이면 새 대화) */
  conversationTitle: string | null;
  onSubmit: (question: string) => void;
  onClose: () => void;
  onOpenList: () => void;
  onNewConversation: () => void;
}

export function AiCommandBar({
  provider,
  shortcutLabel,
  pending,
  conversationTitle,
  onSubmit,
  onClose,
  onOpenList,
  onNewConversation,
}: AiCommandBarProps) {
  const { register, handleSubmit, setFocus, watch } =
    useForm<AiCommandFormValues>({
      defaultValues: { question: "" },
    });
  const { ref: questionRef, ...questionField } = register("question");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const question = watch("question");

  useEffect(() => {
    setFocus("question");
  }, [setFocus]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [question]);

  const submit = handleSubmit(({ question }) => {
    if (!question.trim()) return;
    onSubmit(question);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    // 한글 조합 확정용 Enter는 전송하지 않는다 (WebKit은 keyCode 229로 온다)
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void submit();
  }

  return createPortal(
    <>
      <div className="ai-command-backdrop" aria-hidden onClick={onClose} />
      <form
        className="ai-command"
        role="dialog"
        aria-label="AI에게 질문하기"
        onSubmit={(event) => void submit(event)}
      >
        <img className="ai-command__avatar" src="/ai-icon2.png" alt="" draggable={false} />
        <textarea
          className="ai-command__input"
          rows={1}
          autoComplete="off"
          spellCheck={false}
          placeholder="무엇이든 물어보세요…"
          onKeyDown={handleKeyDown}
          {...questionField}
          ref={(element) => {
            questionRef(element);
            textareaRef.current = element;
          }}
        />
        <div className="ai-command__conversation">
          <span className="ai-command__conversation-title" title={conversationTitle ?? undefined}>
            {conversationTitle ? `이어서: ${conversationTitle}` : "새 대화"}
          </span>
          {conversationTitle ? (
            <button type="button" className="ai-command__link" onClick={onNewConversation}>
              새 대화
            </button>
          ) : null}
          <button type="button" className="ai-command__link" onClick={onOpenList}>
            대화 목록
          </button>
        </div>
        <div className="ai-command__meta">
          <span className={`ai-command__provider ai-command__provider--${provider}`}>
            <AiProviderIcon provider={provider} className="ai-command__provider-icon" />
            {getAiProviderLabel(provider)}
          </span>
          <span className="ai-command__keys">
            <kbd>↵</kbd> 전송 <kbd>⇧↵</kbd> 줄바꿈 <kbd>esc</kbd> 닫기{" "}
            <kbd>{shortcutLabel}</kbd>
          </span>
        </div>
        {pending ? (
          <p className="ai-command__notice">
            이전 응답을 생성 중입니다. 새로 질문하면 이전 응답은 중단됩니다.
          </p>
        ) : null}
      </form>
    </>,
    document.body,
  );
}
