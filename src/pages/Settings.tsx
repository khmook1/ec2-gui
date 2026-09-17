import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { open } from "@tauri-apps/plugin-dialog";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import { FormField, FormSection } from "@/components/common/FormField";
import { PageToolbar } from "@/components/common/PageToolbar";
import {
  useClearAppCacheMutation,
  useClearWallpaperImageMutation,
  useSetWallpaperImageMutation,
  useStoragePathsQuery,
} from "@/hooks/query";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  WALLPAPER_PRESET_OPTIONS,
  type ThemeMode,
  type WallpaperPreset,
} from "@/types/settings";
import "./css/settings.css";

interface SettingsFormValues {
  theme: ThemeMode;
  wallpaperPreset: WallpaperPreset;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

export function SettingsPage() {
  const theme = useSettingsStore((state) => state.theme);
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setWallpaperPreset = useSettingsStore(
    (state) => state.setWallpaperPreset,
  );
  const setCustomWallpaper = useSettingsStore(
    (state) => state.setCustomWallpaper,
  );
  const clearCustomWallpaper = useSettingsStore(
    (state) => state.clearCustomWallpaper,
  );

  const pathsQuery = useStoragePathsQuery();
  const clearCacheMutation = useClearAppCacheMutation();
  const setWallpaperMutation = useSetWallpaperImageMutation();
  const clearWallpaperMutation = useClearWallpaperImageMutation();

  const paths = pathsQuery.data ?? null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutationBusy =
    busy ||
    clearCacheMutation.isPending ||
    setWallpaperMutation.isPending ||
    clearWallpaperMutation.isPending;

  const { watch, setValue } = useForm<SettingsFormValues>({
    defaultValues: {
      theme,
      wallpaperPreset: wallpaper.preset,
    },
  });

  const formTheme = watch("theme");
  const formWallpaper = watch("wallpaperPreset");

  useEffect(() => {
    setValue("theme", theme);
    setValue("wallpaperPreset", wallpaper.preset);
  }, [setValue, theme, wallpaper.preset]);

  async function handleThemeChange(next: ThemeMode) {
    setValue("theme", next);
    setError(null);
    await setTheme(next);
  }

  async function handleWallpaperPreset(
    next: Exclude<WallpaperPreset, "custom">,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (wallpaper.preset === "custom") {
        await clearWallpaperMutation.mutateAsync().catch(() => undefined);
      }
      setValue("wallpaperPreset", next);
      await setWallpaperPreset(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "배경 설정에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePickWallpaper() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
        ],
      });
      if (typeof selected !== "string") {
        return;
      }
      const dataUrl = await setWallpaperMutation.mutateAsync(selected);
      setValue("wallpaperPreset", "custom");
      await setCustomWallpaper(dataUrl);
      setMessage("사용자 배경 이미지를 적용했습니다.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "배경 이미지를 불러오지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClearCustomWallpaper() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await clearWallpaperMutation.mutateAsync().catch(() => undefined);
      setValue("wallpaperPreset", "none");
      await clearCustomWallpaper();
      setMessage("배경 이미지를 제거했습니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "배경 제거에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClearCache() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await clearCacheMutation.mutateAsync();
      setMessage("캐시를 비웠습니다. 설정값은 유지됩니다.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "캐시 삭제에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="explorer settings-page">
      <PageToolbar>
        <p className="page-toolbar__hint">
          GUI 테마와 배경화면을 설정합니다. 설정은 OS 앱 데이터에 저장됩니다.
        </p>
      </PageToolbar>

      <div className="settings-page__content">
        <FormSection title="외관">
          <FormField label="다크 모드" as="div">
            <div
              className="settings-segmented"
              role="tablist"
              aria-label="테마"
            >
              {THEME_OPTIONS.map((option) => {
                const isActive = formTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={[
                      "settings-segmented__item",
                      isActive ? "settings-segmented__item--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={mutationBusy}
                    onClick={() => void handleThemeChange(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label="배경화면" as="div" width="wide">
            <div
              className="settings-wallpaper-grid"
              role="listbox"
              aria-label="배경 프리셋"
            >
              {WALLPAPER_PRESET_OPTIONS.map((option) => {
                const isActive = formWallpaper === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={[
                      "settings-wallpaper-card",
                      `settings-wallpaper-card--${option.id}`,
                      isActive ? "settings-wallpaper-card--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={mutationBusy}
                    onClick={() => void handleWallpaperPreset(option.id)}
                  >
                    <span
                      className="settings-wallpaper-card__swatch"
                      aria-hidden
                    />
                    <span className="settings-wallpaper-card__label">
                      {option.label}
                    </span>
                    <span className="settings-wallpaper-card__desc">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="settings-wallpaper-actions">
              <Button
                variant="ghost"
                disabled={mutationBusy}
                onClick={() => void handlePickWallpaper()}
              >
                이미지 선택…
              </Button>
              {wallpaper.preset === "custom" ? (
                <Button
                  variant="ghost"
                  disabled={mutationBusy}
                  onClick={() => void handleClearCustomWallpaper()}
                >
                  사용자 배경 제거
                </Button>
              ) : null}
            </div>
            {formWallpaper === "custom" && wallpaper.customDataUrl ? (
              <div
                className="settings-wallpaper-preview"
                style={{
                  backgroundImage: `url("${wallpaper.customDataUrl}")`,
                }}
                aria-label="선택한 배경 미리보기"
              />
            ) : null}
          </FormField>
        </FormSection>

        <FormSection title="저장소">
          <div className="settings-storage-actions">
            <Button
              variant="ghost"
              disabled={mutationBusy}
              onClick={() => void handleClearCache()}
            >
              캐시 비우기
            </Button>
          </div>
          <div className="settings-info-list" aria-label="저장 경로">
            <Alert variant="info" title="앱 데이터">
              <p className="alert__mono">
                {paths?.appData ?? "경로를 불러오는 중…"}
              </p>
            </Alert>
            <Alert variant="info" title="캐시">
              <p className="alert__mono">
                {paths?.cache ?? "경로를 불러오는 중…"}
              </p>
            </Alert>
            <Alert variant="info" title="로그">
              <p className="alert__mono">
                {paths?.logs ?? "경로를 불러오는 중…"}
              </p>
            </Alert>
          </div>
        </FormSection>

        {message ? (
          <Alert variant="success" role="status">
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="error" role="alert">
            {error}
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
