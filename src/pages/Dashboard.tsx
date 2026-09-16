import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { useAppStore } from "@/stores/appStore";
import { formatLabel } from "@/utils/format";

const PANEL_MIN_WIDTH = 220;
const PANEL_MIN_HEIGHT = 120;
const PANEL_DEFAULT_WIDTH = 320;
const PANEL_DEFAULT_HEIGHT = 160;

function clampPanelWidth(width: number) {
  return Math.max(PANEL_MIN_WIDTH, Math.min(width, window.innerWidth - 48));
}

function clampPanelHeight(height: number) {
  return Math.max(PANEL_MIN_HEIGHT, Math.min(height, window.innerHeight - 48));
}

export function DashboardPage() {
  const status = useAppStore((state) => state.status);
  const appInfo = useAppStore((state) => state.appInfo);
  const appReady = status === "ready";

  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [panelHeight, setPanelHeight] = useState(PANEL_DEFAULT_HEIGHT);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartWidth = useRef(panelWidth);
  const dragStartHeight = useRef(panelHeight);
  const resizingRef = useRef(false);

  const stopResize = useCallback(() => {
    if (!resizingRef.current) {
      return;
    }
    resizingRef.current = false;
    document.body.classList.remove("info-panel-resizing");
  }, []);

  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      resizingRef.current = true;
      dragStartX.current = event.clientX;
      dragStartY.current = event.clientY;
      dragStartWidth.current = panelWidth;
      dragStartHeight.current = panelHeight;
      document.body.classList.add("info-panel-resizing");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [panelHeight, panelWidth],
  );

  const handleResizePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resizingRef.current) {
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - dragStartX.current;
      const deltaY = event.clientY - dragStartY.current;
      setPanelWidth(clampPanelWidth(dragStartWidth.current + deltaX));
      setPanelHeight(clampPanelHeight(dragStartHeight.current + deltaY));
    },
    [],
  );

  const handleResizePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resizingRef.current) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      stopResize();
    },
    [stopResize],
  );

  useEffect(() => {
    return () => {
      document.body.classList.remove("info-panel-resizing");
    };
  }, []);

  return (
    <section className="explorer dashboard-page">
      <div className="dashboard-page__content">
        <div
          className="dashboard-page__grid"
          style={{
            gridTemplateColumns: `${panelWidth}px`,
            gridTemplateRows: `${panelHeight}px`,
          }}
        >
          <div className="dashboard-page__panel">
            <InfoPanel
              tone="neutral"
              title="앱 정보"
              value={formatLabel(appInfo?.name)}
              description={
                <>
                  버전 {formatLabel(appInfo?.version)} · Tauri{" "}
                  {appReady ? "정상" : "확인 중"}
                </>
              }
            />
            <div
              className="info-panel__resize"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              role="separator"
              aria-orientation="horizontal"
              aria-valuemin={PANEL_MIN_WIDTH}
              aria-valuenow={panelWidth}
              aria-label="앱 정보 패널 크기 조절"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
