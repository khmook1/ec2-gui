import { formatModifiedTime } from "@/utils/file";

export function githubErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function formatGitHubTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "—" : formatModifiedTime(time / 1000);
}

/** GitHub 라벨 배경색(hex)에 맞춰 읽기 쉬운 글자색을 고른다. */
export function labelTextColor(hex: string): string {
  const value = Number.parseInt(hex, 16);
  if (Number.isNaN(value) || hex.length !== 6) {
    return "inherit";
  }
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1f2328" : "#ffffff";
}

/** 토픽 입력(쉼표·공백 구분)을 GitHub 규칙(소문자, 영숫자·하이픈)에 맞게 정리한다. */
export function parseTopics(input: string): string[] {
  const names = input
    .split(/[,\s]+/)
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(names));
}

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Python: "#3572a5",
  Go: "#00add8",
  Java: "#b07219",
  Kotlin: "#a97bff",
  Swift: "#f05138",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00b4ab",
  MDX: "#fcb32c",
};

export function languageColor(name: string): string {
  return LANGUAGE_COLORS[name] ?? "#8b949e";
}
