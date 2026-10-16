export type ThemeMode = "light" | "dark" | "system";

export type WallpaperPreset =
  "none" | "aurora" | "mesh" | "dusk" | "agent" | "custom";

export interface WallpaperSettings {
  preset: WallpaperPreset;
  /** custom 선택 시 data URL (앱 데이터 디렉터리에 복사된 이미지) */
  customDataUrl: string | null;
}

export type AiProvider = "codex" | "claude";
export type AiIconVariant = "default" | "kurimanjyu";

export const AI_ICON_SOURCES: Record<
  AiIconVariant,
  { idle: string; active: string }
> = {
  default: { idle: "/ai/default/ai-icon2.png", active: "/ai/default/ai-icon1.png" },
  kurimanjyu: {
    idle: "/ai/kurimanju/ai-icon-kurimanjyu-v2.png",
    active: "/ai/kurimanju/ai-icon-kurimanjyu.png",
  },
};

export interface AiSettings {
  /** null이면 AI 미연결 (캐릭터 숨김) */
  provider: AiProvider | null;
  /** 비우면 PATH에서 자동 탐색 */
  binaryPath: string | null;
  icon: AiIconVariant;
}

export interface AppSettings {
  theme: ThemeMode;
  wallpaper: WallpaperSettings;
  /** 루트 글자 크기(px). 목록 아이템 크기도 이 값에 비례한다 */
  fontSize: number;
  ai: AiSettings;
}

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
/** 파일 탐색기 기준 크기 */
export const FONT_SIZE_DEFAULT = 16;

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return FONT_SIZE_DEFAULT;
  }
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  wallpaper: {
    preset: "none",
    customDataUrl: null,
  },
  fontSize: FONT_SIZE_DEFAULT,
  ai: {
    provider: null,
    binaryPath: null,
    icon: "default",
  },
};

export const AI_PROVIDER_OPTIONS: {
  id: AiProvider;
  label: string;
  command: string;
  description: string;
}[] = [
  {
    id: "codex",
    label: "Codex CLI",
    command: "codex",
    description: "OpenAI",
  },
  {
    id: "claude",
    label: "Claude Code",
    command: "claude",
    description: "Anthropic",
  },
];

export function getAiProviderLabel(provider: AiProvider): string {
  return (
    AI_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ??
    provider
  );
}

export const WALLPAPER_PRESET_OPTIONS: {
  id: Exclude<WallpaperPreset, "custom">;
  label: string;
  description: string;
}[] = [
  { id: "none", label: "없음", description: "기본 배경색" },
  { id: "aurora", label: "오로라", description: "부드러운 그라데이션" },
  { id: "mesh", label: "메시", description: "은은한 레이어드 톤" },
  { id: "dusk", label: "더스크", description: "따뜻한 석양 톤" },
  { id: "agent", label: "에이전트", description: "파일 탐색 일러스트" },
];
