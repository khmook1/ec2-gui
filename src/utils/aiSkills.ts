import type { AiSkill } from "@/types/ai";

export function filterAiSkills(skills: AiSkill[], query: string): AiSkill[] {
  const keyword = query.toLowerCase();
  return skills.filter(
    (skill) =>
      skill.id.startsWith(keyword) ||
      skill.label.toLowerCase().includes(keyword),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `@id` 토큰을 캡처 그룹으로 나누는 패턴. 스킬이 없으면 null */
export function aiSkillTokenPattern(skills: AiSkill[]): RegExp | null {
  if (skills.length === 0) return null;
  const ids = skills.map((skill) => escapeRegExp(skill.id)).join("|");
  return new RegExp(`(@(?:${ids}))(?![\\w-])`);
}
