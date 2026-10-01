import { useEffect, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
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
  onSubmit: (question: string) => void;
  onClose: () => void;
}

export function AiCommandBar({
  provider,
  shortcutLabel,
  pending,
  onSubmit,
  onClose,
}: AiCommandBarProps) {
  const { register, handleSubmit, setFocus } = useForm<AiCommandFormValues>({
    defaultValues: { question: "" },
  });

  useEffect(() => {
    setFocus("question");
  }, [setFocus]);

  const submit = handleSubmit(({ question }) => {
    if (!question.trim()) return;
    onSubmit(question);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    // 한글 조합 확정용 Enter는 전송하지 않는다 (WebKit은 keyCode 229로 온다)
    if (
      event.key === "Enter" &&
      (event.nativeEvent.isComposing || event.keyCode === 229)
    ) {
      event.preventDefault();
    }
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
        <input
          className="ai-command__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="무엇이든 물어보세요…"
          onKeyDown={handleKeyDown}
          {...register("question")}
        />
        <div className="ai-command__meta">
          <span className="ai-command__provider">{getAiProviderLabel(provider)}</span>
          <span className="ai-command__keys">
            <kbd>↵</kbd> 전송 <kbd>esc</kbd> 닫기 <kbd>{shortcutLabel}</kbd>
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
