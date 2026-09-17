import { useEffect, useMemo, useState } from "react";
import { useServerSyncProgress } from "@/hooks/useServerSyncProgress";
import { useConnectionStore } from "@/stores/connectionStore";
import "./css/server-sync-overlay.css";

const CHARACTER_SRC = [
  "/app-icon.png",
  "/lodding-icon.png",
  "/bg.png",
] as const;

const CHARACTER_CYCLE_MS = 2200;

export function ServerSyncOverlay() {
  const completeServerSync = useConnectionStore(
    (state) => state.completeServerSync,
  );
  const { progress, isComplete, completed, total } = useServerSyncProgress();
  const [characterIndex, setCharacterIndex] = useState(0);

  useEffect(() => {
    if (isComplete) {
      return;
    }

    const timer = window.setInterval(() => {
      setCharacterIndex((prev) => (prev + 1) % CHARACTER_SRC.length);
    }, CHARACTER_CYCLE_MS);

    return () => window.clearInterval(timer);
  }, [isComplete]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    const timer = window.setTimeout(() => {
      completeServerSync();
    }, 420);

    return () => window.clearTimeout(timer);
  }, [isComplete, completeServerSync]);

  const percent = useMemo(
    () => Math.round(Math.min(1, Math.max(0, progress)) * 100),
    [progress],
  );

  const characterSrc = CHARACTER_SRC[characterIndex] ?? CHARACTER_SRC[0];

  return (
    <div
      className="server-sync-overlay"
      role="status"
      aria-live="polite"
      aria-busy={!isComplete}
      aria-label="서버 정보를 연동 중입니다"
    >
      <div className="server-sync-overlay__panel">
        <p className="server-sync-overlay__eyebrow">서버 연동</p>
        <h2 className="server-sync-overlay__title">
          서버 정보를 연동 중입니다
        </h2>
        <p className="server-sync-overlay__subtitle">
          디스크·시스템·권한 정보를 불러오는 중이에요.
          {total > 0 ? ` (${completed}/${total})` : null}
        </p>

        <div className="server-sync-overlay__track-wrap">
          <div
            className="server-sync-overlay__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="server-sync-overlay__fill"
              style={{ width: `${percent}%` }}
            />
            <div
              className="server-sync-overlay__character"
              style={{ left: `${percent}%` }}
            >
              <img
                key={characterSrc}
                className="server-sync-overlay__character-img"
                src={characterSrc}
                alt=""
                draggable={false}
              />
            </div>
          </div>
          <p className="server-sync-overlay__percent">{percent}%</p>
        </div>
      </div>
    </div>
  );
}
