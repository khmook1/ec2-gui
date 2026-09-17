export type ThemeMode = "light" | "dark" | "system";

export type WallpaperPreset =
  | "none"
  | "aurora"
  | "mesh"
  | "dusk"
  | "agent"
  | "custom";

export interface WallpaperSettings {
  preset: WallpaperPreset;
  /** custom 선택 시 data URL (앱 데이터 디렉터리에 복사된 이미지) */
  customDataUrl: string | null;
}

export interface AppSettings {
  theme: ThemeMode;
  wallpaper: WallpaperSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "system",
  wallpaper: {
    preset: "none",
    customDataUrl: null,
  },
};

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
