import { LazyStore } from "@tauri-apps/plugin-store";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type ThemeMode,
  type WallpaperPreset,
} from "@/types/settings";

const STORE_FILE = "settings.json";
const SETTINGS_KEY = "appSettings";
const BROWSER_FALLBACK_KEY = "ec2-gui-app-settings";

let storePromise: Promise<LazyStore> | null = null;

function getStore(): Promise<LazyStore> {
  if (!storePromise) {
    storePromise = Promise.resolve(
      new LazyStore(STORE_FILE, {
        autoSave: true,
        defaults: {
          [SETTINGS_KEY]: DEFAULT_APP_SETTINGS,
        },
      }),
    );
  }
  return storePromise;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isWallpaperPreset(value: unknown): value is WallpaperPreset {
  return (
    value === "none" ||
    value === "aurora" ||
    value === "mesh" ||
    value === "dusk" ||
    value === "custom"
  );
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_APP_SETTINGS, wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper } };
  }

  const record = value as Record<string, unknown>;
  const wallpaperRaw =
    record.wallpaper && typeof record.wallpaper === "object"
      ? (record.wallpaper as Record<string, unknown>)
      : {};

  const preset = isWallpaperPreset(wallpaperRaw.preset)
    ? wallpaperRaw.preset
    : DEFAULT_APP_SETTINGS.wallpaper.preset;

  const customDataUrl =
    typeof wallpaperRaw.customDataUrl === "string"
      ? wallpaperRaw.customDataUrl
      : null;

  return {
    theme: isThemeMode(record.theme) ? record.theme : DEFAULT_APP_SETTINGS.theme,
    wallpaper: {
      preset,
      customDataUrl: preset === "custom" ? customDataUrl : null,
    },
  };
}

function readBrowserFallback(): AppSettings | null {
  try {
    const raw = localStorage.getItem(BROWSER_FALLBACK_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeBrowserFallback(settings: AppSettings): void {
  try {
    localStorage.setItem(BROWSER_FALLBACK_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

export async function loadPersistedSettings(): Promise<AppSettings> {
  try {
    const store = await getStore();
    const value = await store.get<unknown>(SETTINGS_KEY);
    if (value === undefined) {
      const fallback = readBrowserFallback();
      return fallback ?? {
        ...DEFAULT_APP_SETTINGS,
        wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper },
      };
    }
    return normalizeSettings(value);
  } catch {
    return (
      readBrowserFallback() ?? {
        ...DEFAULT_APP_SETTINGS,
        wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper },
      }
    );
  }
}

export async function savePersistedSettings(settings: AppSettings): Promise<void> {
  writeBrowserFallback(settings);
  try {
    const store = await getStore();
    await store.set(SETTINGS_KEY, settings);
  } catch {
    // 브라우저(vite only)에서는 store 플러그인이 없을 수 있음
  }
}
