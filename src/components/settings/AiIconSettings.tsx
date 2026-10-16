import { SelectionCheck } from "@/components/common/SelectionCheck";
import { useSettingsStore } from "@/stores/settingsStore";
import { AI_ICON_SOURCES, type AiIconVariant } from "@/types/settings";
import "./css/ai-icon-settings.css";

const OPTIONS: { id: AiIconVariant; label: string; description: string }[] = [
  { id: "default", label: "기본", description: "기존 AI 캐릭터" },
  { id: "kurimanjyu", label: "쿠리만쥬", description: "먼작귀 쿠리만쥬" },
];

export function AiIconSettings() {
  const selected = useSettingsStore((state) => state.ai.icon);
  const setAiIcon = useSettingsStore((state) => state.setAiIcon);

  return (
    <div
      className="ai-icon-settings"
      role="radiogroup"
      aria-label="AI 아이콘 선택"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected === option.id}
          className={`ai-icon-settings__option ${selected === option.id ? "ai-icon-settings__option--selected" : ""}`}
          onClick={() => void setAiIcon(option.id)}
        >
          <span className="ai-icon-settings__preview">
            <img
              src={AI_ICON_SOURCES[option.id].idle}
              alt=""
              draggable={false}
            />
          </span>
          <span className="ai-icon-settings__text">
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
          <SelectionCheck checked={selected === option.id} />
        </button>
      ))}
    </div>
  );
}
