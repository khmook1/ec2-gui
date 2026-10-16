import type { AiSkill } from "@/types/ai";
import "./css/ai-skill-menu.css";

interface AiSkillMenuProps {
  id: string;
  skills: AiSkill[];
  activeIndex: number;
  onSelect: (skill: AiSkill) => void;
  onHover: (index: number) => void;
}

export function AiSkillMenu({
  id,
  skills,
  activeIndex,
  onSelect,
  onHover,
}: AiSkillMenuProps) {
  return (
    <ul id={id} className="ai-skill-menu" role="listbox" aria-label="AI 스킬">
      {skills.map((skill, index) => (
        <li
          key={skill.id}
          id={`${id}-${skill.id}`}
          role="option"
          aria-selected={index === activeIndex}
          className={`ai-skill-menu__item${index === activeIndex ? " ai-skill-menu__item--active" : ""}`}
          // 입력창 포커스를 유지해야 선택 후 바로 이어서 입력할 수 있다.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHover(index)}
          onClick={() => onSelect(skill)}
        >
          <span className="ai-skill-menu__name">@{skill.id}</span>
          <span className="ai-skill-menu__body">
            <strong>
              {skill.label}
              {skill.requiresSsh ? <small>SSH 접속 필요</small> : null}
            </strong>
            <span>{skill.description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
