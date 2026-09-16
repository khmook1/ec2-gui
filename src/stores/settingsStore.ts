import { create } from "zustand";
import {
  loadPersistedSettings,
  savePersistedSettings,
} from "@/lib/settingsPersistence";
import { applySettingsToDocument } from "@/lib/theme";
import {
  DEFAULT_APP_SETTINGS,
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
}

async function persistAndApply(settings: AppSettings): Promise<void> {
  applySettingsToDocument(settings);
  await savePersistedSettings(settings);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper },
  hydrated: false,

  hydrate: async () => {
    const settings = await loadPersistedSettings();
    applySettingsToDocument(settings);
    set({ ...settings, hydrated: true });
  },

  setTheme: async (theme) => {
    const next: AppSettings = {
      theme,
      wallpaper: get().wallpaper,
    };
    set(next);
    await persistAndApply(next);
  },

  setWallpaperPreset: async (preset) => {
    const current = get().wallpaper;
    const next: AppSettings = {
      theme: get().theme,
      wallpaper: {
        preset,
        customDataUrl: preset === "custom" ? current.customDataUrl : null,
      },
    };
    set(next);
    await persistAndApply(next);
  },

  setCustomWallpaper: async (customDataUrl) => {
    const next: AppSettings = {
      theme: get().theme,
      wallpaper: {
        preset: "custom",
        customDataUrl,
      },
    };
    set(next);
    await persistAndApply(next);
  },

  clearCustomWallpaper: async () => {
    const next: AppSettings = {
      theme: get().theme,
      wallpaper: {
        preset: "none",
        customDataUrl: null,
      },
    };
    set(next);
    await persistAndApply(next);
  },
}));
