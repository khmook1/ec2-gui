import { useEffect, useState } from "react";
import { resolveTheme } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settingsStore";

export function useResolvedTheme(): "light" | "dark" {
  const theme = useSettingsStore((state) => state.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(theme));

  useEffect(() => {
    setResolved(resolveTheme(theme));

    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setResolved(resolveTheme("system"));
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const next = root.dataset.theme;
      if (next === "light" || next === "dark") {
        setResolved(next);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return resolved;
}
