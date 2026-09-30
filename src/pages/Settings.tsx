import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { open } from "@tauri-apps/plugin-dialog";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import { FormField, FormSection } from "@/components/common/FormField";
import { PageToolbar } from "@/components/common/PageToolbar";
import { StorageLocations } from "@/components/settings/StorageLocations";
import {
  useClearAppCacheMutation,
  useClearWallpaperImageMutation,
  useSetWallpaperImageMutation,
} from "@/hooks/query";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  clampFontSize,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  WALLPAPER_PRESET_OPTIONS,
  type ThemeMode,
  type WallpaperPreset,
} from "@/types/settings";
import "./css/settings.css";

interface SettingsFormValues {
  theme: ThemeMode;
  wallpaperPreset: WallpaperPreset;
  fontSize: number;
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
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);

  const clearCacheMutation = useClearAppCacheMutation();
  const setWallpaperMutation = useSetWallpaperImageMutation();
  const clearWallpaperMutation = useClearWallpaperImageMutation();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutationBusy =
    busy ||
    clearCacheMutation.isPending ||
    setWallpaperMutation.isPending ||
    clearWallpaperMutation.isPending;

  const { register, watch, setValue } = useForm<SettingsFormValues>({
    defaultValues: {
      theme,
      wallpaperPreset: wallpaper.preset,
      fontSize,
    },
  });

  const formTheme = watch("theme");
  const formWallpaper = watch("wallpaperPreset");
  const formFontSize = watch("fontSize");

  useEffect(() => {
    setValue("theme", theme);
    setValue("wallpaperPreset", wallpaper.preset);
  }, [setValue, theme, wallpaper.preset]);

  useEffect(() => {
    setValue("fontSize", fontSize);
  }, [setValue, fontSize]);

  function applyFontSize(value: number) {
    if (value < FONT_SIZE_MIN || value > FONT_SIZE_MAX) {
      return;
    }
    const next = clampFontSize(value);
    if (next !== fontSize) {
      void setFontSize(next);
    }
  }

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
          GUI 테마, 글자 크기, 배경화면을 설정합니다. 저장소에서 데이터가 저장되는 위치를 확인하고 열 수 있습니다.
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

          <FormField label="글자 크기" as="div" width="wide">
            <div className="settings-font-size">
              <input
                type="range"
                className="settings-font-size__range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={Number.isFinite(formFontSize) ? formFontSize : fontSize}
                aria-label="글자 크기 슬라이더"
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  setValue("fontSize", value);
                  applyFontSize(value);
                }}
              />
              <label className="settings-font-size__input">
                <input
                  type="number"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  aria-label="글자 크기(px)"
                  {...register("fontSize", {
                    valueAsNumber: true,
                    onChange: (event) =>
                      applyFontSize(
                        (event.target as HTMLInputElement).valueAsNumber,
                      ),
                    onBlur: () => {
                      const next = clampFontSize(formFontSize);
                      setValue("fontSize", next);
                      applyFontSize(next);
                    },
                  })}
                />
                <span>px</span>
              </label>
              <Button
                variant="ghost"
                disabled={fontSize === FONT_SIZE_DEFAULT}
                onClick={() => {
                  setValue("fontSize", FONT_SIZE_DEFAULT);
                  applyFontSize(FONT_SIZE_DEFAULT);
                }}
              >
                기본값 ({FONT_SIZE_DEFAULT}px)
              </Button>
            </div>
            <p className="settings-font-size__hint">
              앱 전체 글자와 파일 탐색기·Docker·GitHub 목록 아이템(카드·리스트) 크기가 함께
              바뀝니다. 기본값 {FONT_SIZE_DEFAULT}px이 파일 탐색기 기준 크기입니다.
            </p>
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
          <StorageLocations
            disabled={mutationBusy}
            onError={(nextError) => {
              setMessage(null);
              setError(nextError);
            }}
          />
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
