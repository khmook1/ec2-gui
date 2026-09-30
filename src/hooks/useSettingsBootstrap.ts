import { useEffect } from "react";
import { applySettingsToDocument, watchSystemTheme } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settingsStore";

export function useSettingsBootstrap() {
  const hydrate = useSettingsStore((state) => state.hydrate);
  const theme = useSettingsStore((state) => state.theme);
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const hydrated = useSettingsStore((state) => state.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    applySettingsToDocument({ theme, wallpaper, fontSize });
    return watchSystemTheme(theme, () => {
      applySettingsToDocument({ theme, wallpaper, fontSize });
    });
  }, [hydrated, theme, wallpaper, fontSize]);
}
