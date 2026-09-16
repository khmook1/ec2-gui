import type { AppSettings, ThemeMode, WallpaperPreset } from "@/types/settings";

export function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function wallpaperCssValue(
  preset: WallpaperPreset,
  customDataUrl: string | null,
): string {
  switch (preset) {
    case "aurora":
      return "radial-gradient(ellipse at 20% 20%, rgba(0, 113, 227, 0.22), transparent 48%), radial-gradient(ellipse at 80% 0%, rgba(52, 199, 89, 0.14), transparent 42%), radial-gradient(ellipse at 50% 100%, rgba(175, 82, 222, 0.12), transparent 50%)";
    case "mesh":
      return "radial-gradient(circle at 10% 90%, rgba(90, 200, 250, 0.16), transparent 40%), radial-gradient(circle at 90% 20%, rgba(255, 159, 10, 0.12), transparent 38%), linear-gradient(160deg, rgba(0, 0, 0, 0.03), transparent 60%)";
    case "dusk":
      return "radial-gradient(ellipse at 30% 0%, rgba(255, 149, 0, 0.2), transparent 45%), radial-gradient(ellipse at 100% 80%, rgba(255, 59, 48, 0.12), transparent 40%), linear-gradient(180deg, rgba(88, 86, 214, 0.08), transparent 55%)";
    case "custom":
      return customDataUrl
        ? `url("${customDataUrl}") center / cover no-repeat`
        : "none";
    case "none":
    default:
      return "none";
  }
}

export function applySettingsToDocument(settings: AppSettings): void {
  const resolved = resolveTheme(settings.theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  root.style.setProperty(
    "--wallpaper-layer",
    wallpaperCssValue(settings.wallpaper.preset, settings.wallpaper.customDataUrl),
  );
}

export function watchSystemTheme(
  theme: ThemeMode,
  onChange: () => void,
): () => void {
  if (theme !== "system") {
    return () => undefined;
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => onChange();
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
