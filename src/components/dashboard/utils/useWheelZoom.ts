import { useEffect } from "react";

/** 한 단계 이동에 필요한 누적 휠 이동량(px). 트랙패드의 잦은 작은 이벤트를 묶는다. */
const WHEEL_STEP_PX = 60;
const LINE_HEIGHT_PX = 16;

/**
 * `el`(또는 그 자식)에 포커스가 있을 때만 휠을 가로채 `onStep(+1 | -1)`을 호출합니다.
 * 아래로 굴리면 +1(범위 확장), 위로 굴리면 -1(범위 축소). 포커스가 없으면 페이지 스크롤을 그대로 둡니다.
 * React `onWheel`은 passive라 `preventDefault`가 안 되므로 네이티브 리스너를 쓴다.
 * `onStep`이 바뀌면 리스너를 다시 등록하므로 안정된 참조(`useCallback`)를 넘긴다.
 */
export function useWheelZoom(
  el: HTMLElement | null,
  onStep: (direction: 1 | -1) => void,
) {
  useEffect(() => {
    if (!el) {
      return;
    }
    let accumulated = 0;

    const handleWheel = (event: WheelEvent) => {
      if (!el.contains(document.activeElement)) {
        return;
      }
      event.preventDefault();
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * LINE_HEIGHT_PX
          : event.deltaY;
      if (Math.sign(delta) !== Math.sign(accumulated)) {
        accumulated = 0;
      }
      accumulated += delta;
      if (Math.abs(accumulated) >= WHEEL_STEP_PX) {
        onStep(accumulated > 0 ? 1 : -1);
        accumulated = 0;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [el, onStep]);
}
