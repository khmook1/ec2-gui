import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTypewriter } from "@/hooks/useTypewriter";
import type { AiApprovalCommand, AiApprovalRisk, AiExchange } from "@/types/ai";
import { SudoPasswordPrompt } from "@/components/explorer/SudoPasswordPrompt";
import { AiDiffView } from "./AiDiffView";
import { AiMarkdown } from "./AiMarkdown";
import "./css/ai-speech-bubble.css";

const STICK_THRESHOLD_PX = 24;
const COPIED_FEEDBACK_MS = 1500;

const RISK_LABELS: Record<AiApprovalRisk, string> = {
  destructive: "삭제·되돌릴 수 없음",
  dockerInstall: "Docker 설치",
  mutating: "상태 변경",
  sensitive: "민감 정보 노출",
  fileWrite: "파일 쓰기",
};

function approvalTitle(commands: AiApprovalCommand[]): string {
  const risks = new Set(commands.map((item) => item.risk));
  if (risks.has("destructive"))
    return "삭제·종료처럼 되돌릴 수 없는 작업이 포함되어 있습니다. 대상을 직접 확인한 뒤에만 실행하세요.";
  if (risks.has("dockerInstall")) return "서버에 Docker를 설치합니다. 아래 스크립트를 실행할까요?";
  if (risks.has("mutating")) return "서버 또는 GitHub 상태를 바꾸는 작업입니다. 실행할까요?";
  if (risks.has("fileWrite")) return "서버 파일을 수정합니다. 변경 내용을 확인한 뒤 실행하세요.";
  return "비밀정보가 노출될 수 있는 조회입니다. 실행할까요?";
}

interface AiSpeechBubbleProps {
  exchange: AiExchange;
  canReset: boolean;
  onCancel: () => void;
  onApprove: () => void;
  onReject: () => void;
  /** null이면 비밀번호 입력 취소 */
  onSudoPassword: (password: string | null) => void;
  onDismiss: () => void;
  onReset: () => void;
}

export function AiSpeechBubble({
  exchange,
  canReset,
  onCancel,
  onApprove,
  onReject,
  onSudoPassword,
  onDismiss,
  onReset,
}: AiSpeechBubbleProps) {
  const { question, answer, status, error, pending, cancelled, approval, sudoPrompt } =
    exchange;
  const visibleAnswer = useTypewriter(answer);
  const typing = pending || visibleAnswer.length < answer.length;
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [copied, setCopied] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);

  useEffect(() => {
    setQuestionExpanded(false);
  }, [question]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body && stickToBottomRef.current) {
      body.scrollTop = body.scrollHeight;
    }
  }, [visibleAnswer, status, error, approval, sudoPrompt]);

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

      <button
        type="button"
        className={`ai-bubble__question ${questionExpanded ? "ai-bubble__question--expanded" : ""}`}
        aria-expanded={questionExpanded}
        onClick={() => setQuestionExpanded((expanded) => !expanded)}
      >
        <span className="ai-bubble__question-label">Q.</span>
        <span className="ai-bubble__question-text">{question}</span>
        <span className="ai-bubble__question-toggle" aria-hidden="true">
          {questionExpanded ? "접기" : "펼치기"}
        </span>
      </button>

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

        {approval ? (
          <div className="ai-bubble__approval" role="alertdialog" aria-label="명령 실행 승인">
            <p className="ai-bubble__approval-title">{approvalTitle(approval.commands)}</p>
            <ul className="ai-bubble__approval-list">
              {approval.commands.map((item, index) => (
                <li key={index} className="ai-bubble__approval-item">
                  <div className="ai-bubble__approval-meta">
                    <span
                      className={`ai-bubble__approval-badge ai-bubble__approval-badge--${item.risk}`}
                    >
                      {RISK_LABELS[item.risk]}
                    </span>
                    <span className="ai-bubble__approval-reason">{item.reason}</span>
                  </div>
                  <pre
                    className={[
                      "ai-bubble__approval-commands",
                      item.risk === "dockerInstall" ? "ai-bubble__approval-commands--script" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {item.command}
                  </pre>
                  {item.diff ? <AiDiffView diff={item.diff} /> : null}
                </li>
              ))}
            </ul>
            <div className="ai-bubble__approval-actions">
              <button
                type="button"
                className="ai-bubble__action ai-bubble__action--danger"
                onClick={onApprove}
              >
                실행
              </button>
              <button type="button" className="ai-bubble__action" onClick={onReject}>
                거부
              </button>
            </div>
          </div>
        ) : null}

        {sudoPrompt ? (
          <div className="ai-bubble__approval" role="alertdialog" aria-label="sudo 비밀번호 입력">
            <p className="ai-bubble__approval-title">
              현재 계정에 쓰기 권한이 없습니다. sudo 비밀번호를 입력하면 저장합니다.
            </p>
            <code className="ai-bubble__sudo-path">{sudoPrompt.path}</code>
            <SudoPasswordPrompt
              key={sudoPrompt.id}
              onSubmit={(password) => onSudoPassword(password)}
              onCancel={() => onSudoPassword(null)}
            />
          </div>
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
