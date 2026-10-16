import { LazyStore } from "@tauri-apps/plugin-store";
import {
  clampFontSize,
  DEFAULT_APP_SETTINGS,
  type AiProvider,
  type AiIconVariant,
  type AiSettings,
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
    value === "agent" ||
    value === "custom"
  );
}

function isAiProvider(value: unknown): value is AiProvider {
  return value === "codex" || value === "claude";
}

function isAiIconVariant(value: unknown): value is AiIconVariant {
  return value === "default" || value === "kurimanjyu";
}

function normalizeAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_APP_SETTINGS.ai };
  }
  const record = value as Record<string, unknown>;
  const binaryPath =
    typeof record.binaryPath === "string" && record.binaryPath.trim()
      ? record.binaryPath.trim()
      : null;
  return {
    provider: isAiProvider(record.provider) ? record.provider : null,
    binaryPath,
    icon: isAiIconVariant(record.icon) ? record.icon : "default",
  };
}

function defaultSettings(): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    wallpaper: { ...DEFAULT_APP_SETTINGS.wallpaper },
    ai: { ...DEFAULT_APP_SETTINGS.ai },
  };
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return defaultSettings();
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
    theme: isThemeMode(record.theme)
      ? record.theme
      : DEFAULT_APP_SETTINGS.theme,
    wallpaper: {
      preset,
      customDataUrl: preset === "custom" ? customDataUrl : null,
    },
    fontSize:
      typeof record.fontSize === "number"
        ? clampFontSize(record.fontSize)
        : DEFAULT_APP_SETTINGS.fontSize,
    ai: normalizeAiSettings(record.ai),
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
      return readBrowserFallback() ?? defaultSettings();
    }
    return normalizeSettings(value);
  } catch {
    return readBrowserFallback() ?? defaultSettings();
  }
}

export async function savePersistedSettings(
  settings: AppSettings,
): Promise<void> {
  writeBrowserFallback(settings);
  try {
    const store = await getStore();
    await store.set(SETTINGS_KEY, settings);
  } catch {
    // 브라우저(vite only)에서는 store 플러그인이 없을 수 있음
  }
}
