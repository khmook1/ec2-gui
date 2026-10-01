import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTypewriter } from "@/hooks/useTypewriter";
import type { AiExchange } from "@/types/ai";
import { AiMarkdown } from "./AiMarkdown";
import "./css/ai-speech-bubble.css";

const STICK_THRESHOLD_PX = 24;
const COPIED_FEEDBACK_MS = 1500;

interface AiSpeechBubbleProps {
  exchange: AiExchange;
  canReset: boolean;
  onCancel: () => void;
  onDismiss: () => void;
  onReset: () => void;
}

export function AiSpeechBubble({
  exchange,
  canReset,
  onCancel,
  onDismiss,
  onReset,
}: AiSpeechBubbleProps) {
  const { question, answer, status, error, pending, cancelled } = exchange;
  const visibleAnswer = useTypewriter(answer);
  const typing = pending || visibleAnswer.length < answer.length;
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (body && stickToBottomRef.current) {
      body.scrollTop = body.scrollHeight;
    }
  }, [visibleAnswer, status, error]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function handleScroll() {
    const body = bodyRef.current;
    if (!body) return;
    stickToBottomRef.current =
      body.scrollHeight - body.scrollTop - body.clientHeight < STICK_THRESHOLD_PX;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return createPortal(
    <div
      className={["ai-bubble", error ? "ai-bubble--error" : ""].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="ai-bubble__close"
        aria-label="말풍선 닫기"
        onClick={onDismiss}
      >
        ×
      </button>

      <p className="ai-bubble__question" title={question}>
        {question}
      </p>

      <div className="ai-bubble__body" ref={bodyRef} onScroll={handleScroll}>
        {visibleAnswer ? (
          <AiMarkdown content={visibleAnswer} typing={typing} />
        ) : pending ? (
          <p className="ai-bubble__thinking">
            <span className="ai-bubble__dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {status ?? "생각 중…"}
          </p>
        ) : null}

        {error ? <p className="ai-bubble__error">{error}</p> : null}
      </div>

      <div className="ai-bubble__footer">
        <span className="ai-bubble__note">
          {pending && answer && status ? status : null}
          {cancelled ? "응답을 중단했습니다" : null}
        </span>
        <div className="ai-bubble__actions">
          {pending ? (
            <button type="button" className="ai-bubble__action" onClick={onCancel}>
              중단
            </button>
          ) : (
            <>
              {answer ? (
                <button
                  type="button"
                  className="ai-bubble__action"
                  onClick={() => void handleCopy()}
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              ) : null}
              {canReset ? (
                <button type="button" className="ai-bubble__action" onClick={onReset}>
                  새 대화
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
