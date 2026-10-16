import { useEffect, useMemo, useRef, useState } from "react";
import { AiCommandBar } from "@/components/ai/AiCommandBar";
import { AiDiffView } from "@/components/ai/AiDiffView";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import { CodeBlock } from "@/components/common/CodeBlock";
import { AiProviderIcon } from "@/components/icons/AiProviderIcons";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { SudoPasswordPrompt } from "@/components/explorer/SudoPasswordPrompt";
import { useAiSkillsQuery } from "@/hooks/query";
import { useAiChatbot } from "@/providers/AiChatbotProvider";
import { useNavStore } from "@/stores/navStore";
import { ROUTE_ID } from "@/config/Route";
import { useSettingsStore } from "@/stores/settingsStore";
import { AI_ICON_SOURCES, getAiProviderLabel } from "@/types/settings";
import { aiSkillTokenPattern } from "@/utils/aiSkills";
import "./css/studio.css";

function QuestionText({
  content,
  tokenPattern,
}: {
  content: string;
  tokenPattern: RegExp | null;
}) {
  if (!tokenPattern) return <p className="studio__question">{content}</p>;
  return (
    <p className="studio__question">
      {content.split(tokenPattern).map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="studio__skill-token">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function StudioPage() {
  const ai = useAiChatbot();
  const provider = useSettingsStore((state) => state.ai.provider);
  const icon = useSettingsStore((state) => state.ai.icon);
  const navigate = useNavStore((state) => state.setActiveId);
  const { data: skills = [] } = useAiSkillsQuery();
  const skillTokenPattern = useMemo(
    () => aiSkillTokenPattern(skills),
    [skills],
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const activeExchange = ai.exchange;
  const messages = useMemo(
    () => ai.conversation?.messages ?? [],
    [ai.conversation],
  );
  const visibleMessages = activeExchange
    ? messages.slice(0, activeExchange.historyCount)
    : messages;

  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeExchange]);

  function submit(question: string) {
    if (!ai.enabled) return;
    ai.ask(question.trim());
    atBottomRef.current = true;
  }

  async function copyAnswer(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        1500,
      );
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="studio" aria-label="AI 채팅">
      <header className="studio__header">
        {provider ? (
          <AiProviderIcon
            provider={provider}
            className={`studio__provider-icon studio__provider-icon--${provider}`}
          />
        ) : null}
        <div>
          <h1>Studio</h1>
          <span>
            {provider ? getAiProviderLabel(provider) : "AI 연결 필요"}
          </span>
        </div>
      </header>

      <div
        className="studio__messages"
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {!ai.enabled ? (
          <div className="studio__empty">
            <h2>AI를 연결해 주세요</h2>
            <p>AI 설정에서 제공자를 선택하면 Studio에서 질문할 수 있습니다.</p>
            <Button onClick={() => navigate(ROUTE_ID.settingsAi)}>
              AI 설정 열기
            </Button>
          </div>
        ) : ai.conversationLoading && ai.activeConversationId ? (
          <LoadingIndicator layout="fill" message="대화를 불러오는 중…" />
        ) : visibleMessages.length === 0 && !activeExchange ? (
          <div className="studio__empty">
            <img src={AI_ICON_SOURCES[icon].idle} alt="" draggable={false} />
            <h2>무엇을 도와드릴까요?</h2>
            <p>
              자유롭게 질문하거나, 입력창에 <kbd>@</kbd>를 입력해 스킬을 지정해
              보세요.
            </p>
            <ul className="studio__skills">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <span className="studio__skill-token">@{skill.id}</span>
                  <strong>{skill.label}</strong>
                  <small>{skill.description}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {visibleMessages.map((message, index) => (
          <article
            key={`${message.createdAt}-${index}`}
            className={`studio__message studio__message--${message.role}`}
          >
            <div className="studio__message-inner">
              {message.role === "user" ? (
                <QuestionText
                  content={message.content}
                  tokenPattern={skillTokenPattern}
                />
              ) : (
                <AiMarkdown content={message.content} tone="theme" />
              )}
              {message.role === "assistant" ? (
                <Button
                  variant="ghost"
                  className="studio__copy"
                  onClick={() =>
                    void copyAnswer(`saved-${index}`, message.content)
                  }
                >
                  {copiedId === `saved-${index}` ? "복사됨" : "복사"}
                </Button>
              ) : null}
            </div>
          </article>
        ))}

        {activeExchange ? (
          <>
            <article className="studio__message studio__message--user">
              <div className="studio__message-inner">
                <QuestionText
                  content={activeExchange.question}
                  tokenPattern={skillTokenPattern}
                />
              </div>
            </article>
            <article
              className="studio__message studio__message--assistant"
              aria-live="polite"
            >
              <div className="studio__message-inner">
                {activeExchange.answer ? (
                  <AiMarkdown
                    content={activeExchange.answer}
                    tone="theme"
                    typing={activeExchange.pending}
                  />
                ) : null}
                {activeExchange.pending && !activeExchange.answer ? (
                  <p className="studio__hint">
                    {activeExchange.status ?? "생각 중…"}
                  </p>
                ) : null}
                {activeExchange.status && activeExchange.answer ? (
                  <p className="studio__hint">{activeExchange.status}</p>
                ) : null}
                {activeExchange.error ? (
                  <Alert variant="error" role="alert">
                    {activeExchange.error}
                  </Alert>
                ) : null}
                {activeExchange.cancelled ? (
                  <p className="studio__hint">응답을 중단했습니다.</p>
                ) : null}
                {activeExchange.approval ? (
                  <Alert
                    variant="warning"
                    role="alertdialog"
                    aria-label="명령 실행 승인"
                    title="다음 작업의 실행을 승인할까요?"
                    className="studio__approval"
                  >
                    {activeExchange.approval.commands.map((item, index) => (
                      <div key={index} className="studio__approval-command">
                        <p>{item.reason}</p>
                        <CodeBlock code={item.command} filename="command.sh" />
                        {item.diff ? <AiDiffView diff={item.diff} /> : null}
                      </div>
                    ))}
                    <div className="studio__approval-actions">
                      <Button onClick={() => ai.respondApproval(true)}>
                        실행
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => ai.respondApproval(false)}
                      >
                        거부
                      </Button>
                    </div>
                  </Alert>
                ) : null}
                {activeExchange.sudoPrompt ? (
                  <Alert
                    variant="warning"
                    role="alertdialog"
                    aria-label="sudo 비밀번호 입력"
                    title="sudo 권한 필요"
                    className="studio__approval"
                  >
                    <p>
                      쓰기 권한이 없습니다. sudo 비밀번호를 입력하면 저장합니다.
                    </p>
                    <code>{activeExchange.sudoPrompt.path}</code>
                    <SudoPasswordPrompt
                      key={activeExchange.sudoPrompt.id}
                      onSubmit={ai.respondSudoPassword}
                      onCancel={() => ai.respondSudoPassword(null)}
                    />
                  </Alert>
                ) : null}
                {activeExchange.pending ? (
                  <Button
                    variant="ghost"
                    className="studio__copy"
                    onClick={ai.cancel}
                  >
                    응답 중단
                  </Button>
                ) : activeExchange.answer ? (
                  <Button
                    variant="ghost"
                    className="studio__copy"
                    onClick={() =>
                      void copyAnswer("current", activeExchange.answer)
                    }
                  >
                    {copiedId === "current" ? "복사됨" : "복사"}
                  </Button>
                ) : null}
              </div>
            </article>
          </>
        ) : null}
      </div>

      {ai.enabled && provider ? (
        <div className="studio__composer-wrap">
          <AiCommandBar
            variant="inline"
            provider={provider}
            pending={activeExchange?.pending ?? false}
            onSubmit={submit}
          />
        </div>
      ) : null}
    </section>
  );
}
