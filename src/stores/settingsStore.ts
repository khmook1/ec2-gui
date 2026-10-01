import { create } from "zustand";
import {
  loadPersistedSettings,
  savePersistedSettings,
} from "@/lib/settingsPersistence";
import { applySettingsToDocument } from "@/lib/theme";
import {
  clampFontSize,
  DEFAULT_APP_SETTINGS,
  type AiSettings,
  type AppSettings,
  type ThemeMode,
  type WallpaperPreset,
} from "@/types/settings";

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setWallpaperPreset: (preset: WallpaperPreset) => Promise<void>;
  setCustomWallpaper: (customDataUrl: string) => Promise<void>;
  clearCustomWallpaper: () => Promise<void>;
  setFontSize: (fontSize: number) => Promise<void>;
  setAiSettings: (ai: AiSettings) => Promise<void>;
}

async function persistAndApply(settings: AppSettings): Promise<void> {
  applySettingsToDocument(settings);
  await savePersistedSettings(settings);
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  function current(): AppSettings {
    const { theme, wallpaper, fontSize, ai } = get();
    return { theme, wallpaper, fontSize, ai };
  }

  async function update(patch: Partial<AppSettings>): Promise<void> {
    const next: AppSettings = { ...current(), ...patch };
    set(next);
    await persistAndApply(next);
  }

  return {
    ...DEFAULT_APP_SETTINGS,
    wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper },
    ai: { ...DEFAULT_APP_SETTINGS.ai },
    hydrated: false,

    hydrate: async () => {
      const settings = await loadPersistedSettings();
      applySettingsToDocument(settings);
      set({ ...settings, hydrated: true });
    },

    setTheme: (theme) => update({ theme }),

    setWallpaperPreset: (preset) =>
      update({
        wallpaper: {
          preset,
          customDataUrl:
            preset === "custom" ? get().wallpaper.customDataUrl : null,
        },
      }),

    setCustomWallpaper: (customDataUrl) =>
      update({ wallpaper: { preset: "custom", customDataUrl } }),

    clearCustomWallpaper: () =>
      update({ wallpaper: { preset: "none", customDataUrl: null } }),

    setFontSize: (fontSize) => update({ fontSize: clampFontSize(fontSize) }),

    setAiSettings: (ai) =>
      update({
        ai: { provider: ai.provider, binaryPath: ai.binaryPath?.trim() || null },
      }),
  };
});
