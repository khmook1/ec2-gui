import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { AiSkillMenu } from "@/components/ai/AiSkillMenu";
import { AiProviderIcon } from "@/components/icons/AiProviderIcons";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAiSkillsQuery } from "@/hooks/query";
import type { AiSkill } from "@/types/ai";
import { filterAiSkills } from "@/utils/aiSkills";
import { AI_ICON_SOURCES, getAiProviderLabel, type AiProvider } from "@/types/settings";
import "./css/ai-command-bar.css";

interface SkillMention {
  /** `@` 문자의 위치 */
  start: number;
  query: string;
}

const MENTION_PATTERN = /(?:^|\s)@([\w가-힣-]*)$/;

interface AiCommandFormValues {
  question: string;
}

interface AiCommandBarProps {
  provider: AiProvider;
  /** floating: 포털 + 백드롭 다이얼로그, inline: 페이지 레이아웃 안에 배치 */
  variant?: "floating" | "inline";
  shortcutLabel?: string;
  /** 이전 응답이 아직 생성 중인지 (새 질문 시 이전 응답은 중단된다) */
  pending: boolean;
  /** 이어서 질문할 대화 제목 (null이면 새 대화) */
  conversationTitle?: string | null;
  onSubmit: (question: string) => void;
  onClose?: () => void;
  onOpenList?: () => void;
  onNewConversation?: () => void;
}

export function AiCommandBar({
  provider,
  variant = "floating",
  shortcutLabel,
  pending,
  conversationTitle = null,
  onSubmit,
  onClose,
  onOpenList,
  onNewConversation,
}: AiCommandBarProps) {
  const icon = useSettingsStore((state) => state.ai.icon);
  const inline = variant === "inline";
  const {
    register,
    handleSubmit,
    setFocus,
    watch,
    reset,
    getValues,
    setValue,
  } = useForm<AiCommandFormValues>({
    defaultValues: { question: "" },
  });
  const { ref: questionRef, ...questionField } = register("question");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const question = watch("question");
  const skillMenuId = useId();
  const [mention, setMention] = useState<SkillMention | null>(null);
  const [activeSkill, setActiveSkill] = useState(0);
  const { data: allSkills = [] } = useAiSkillsQuery();
  const skills = mention ? filterAiSkills(allSkills, mention.query) : [];
  const skillMenuOpen = skills.length > 0;
  const activeSkillItem = skills[Math.min(activeSkill, skills.length - 1)];

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
    setMention(null);
    if (inline) reset();
  });

  function updateMention(textarea: HTMLTextAreaElement) {
    const caret = textarea.selectionStart;
    const match =
      caret === textarea.selectionEnd
        ? MENTION_PATTERN.exec(textarea.value.slice(0, caret))
        : null;
    if (!match) {
      setMention(null);
      return;
    }
    const query = match[1] ?? "";
    const start = caret - query.length - 1;
    if (mention?.start === start && mention.query === query) return;
    setMention({ start, query });
    setActiveSkill(0);
  }

  function selectSkill(skill: AiSkill) {
    const textarea = textareaRef.current;
    if (!textarea || !mention) return;
    const value = getValues("question");
    const rest = value.slice(mention.start + 1 + mention.query.length);
    const token = `@${skill.id}${rest.startsWith(" ") ? "" : " "}`;
    const caret = mention.start + token.length;
    setValue("question", value.slice(0, mention.start) + token + rest);
    setMention(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  }

  function handleSkillMenuKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveSkill(
          (current) => (current + step + skills.length) % skills.length,
        );
        break;
      }
      case "Enter":
      case "Tab":
        if (event.nativeEvent.isComposing || event.keyCode === 229) return true;
        if (activeSkillItem) selectSkill(activeSkillItem);
        break;
      case "Escape":
        event.stopPropagation();
        setMention(null);
        break;
      default:
        return false;
    }
    event.preventDefault();
    return true;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (skillMenuOpen && handleSkillMenuKey(event)) return;
    if (event.key === "Escape" && onClose) {
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

  const form = (
    <form
      className={`ai-command${inline ? " ai-command--inline" : ""}`}
      role={inline ? undefined : "dialog"}
      aria-label="AI에게 질문하기"
      onSubmit={(event) => void submit(event)}
    >
      <img
        className="ai-command__avatar"
        src={AI_ICON_SOURCES[icon].idle}
        alt=""
        draggable={false}
      />
      <textarea
        className="ai-command__input"
        rows={1}
        autoComplete="off"
        spellCheck={false}
        placeholder="무엇이든 물어보세요… (@로 스킬 지정)"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={skillMenuOpen}
        aria-controls={skillMenuOpen ? skillMenuId : undefined}
        aria-activedescendant={
          skillMenuOpen ? `${skillMenuId}-${activeSkillItem?.id}` : undefined
        }
        onKeyDown={handleKeyDown}
        onSelect={(event) => updateMention(event.currentTarget)}
        onBlur={(event) => {
          void questionField.onBlur(event);
          setMention(null);
        }}
        name={questionField.name}
        onChange={(event) => {
          void questionField.onChange(event);
          updateMention(event.target);
        }}
        ref={(element) => {
          questionRef(element);
          textareaRef.current = element;
        }}
      />
      {skillMenuOpen ? (
        <AiSkillMenu
          id={skillMenuId}
          skills={skills}
          activeIndex={activeSkill}
          onSelect={selectSkill}
          onHover={setActiveSkill}
        />
      ) : null}
      {inline ? null : (
        <div className="ai-command__conversation">
          <span
            className="ai-command__conversation-title"
            title={conversationTitle ?? undefined}
          >
            {conversationTitle ? `이어서: ${conversationTitle}` : "새 대화"}
          </span>
          {conversationTitle && onNewConversation ? (
            <button
              type="button"
              className="ai-command__link"
              onClick={onNewConversation}
            >
              새 대화
            </button>
          ) : null}
          {onOpenList ? (
            <button
              type="button"
              className="ai-command__link"
              onClick={onOpenList}
            >
              대화 목록
            </button>
          ) : null}
        </div>
      )}
      <div className="ai-command__meta">
        <span
          className={`ai-command__provider ai-command__provider--${provider}`}
        >
          <AiProviderIcon
            provider={provider}
            className="ai-command__provider-icon"
          />
          {getAiProviderLabel(provider)}
        </span>
        <span className="ai-command__keys">
          <kbd>@</kbd> 스킬 <kbd>↵</kbd> 전송 <kbd>⇧↵</kbd> 줄바꿈
          {onClose ? (
            <>
              {" "}
              <kbd>esc</kbd> 닫기
            </>
          ) : null}
          {shortcutLabel ? (
            <>
              {" "}
              <kbd>{shortcutLabel}</kbd>
            </>
          ) : null}
        </span>
      </div>
      {pending ? (
        <p className="ai-command__notice">
          이전 응답을 생성 중입니다. 새로 질문하면 이전 응답은 중단됩니다.
        </p>
      ) : null}
    </form>
  );

  if (inline) return form;

  return createPortal(
    <>
      <div className="ai-command-backdrop" aria-hidden onClick={onClose} />
      {form}
    </>,
    document.body,
  );
}
