import { useEffect } from "react";
import { useNavStore } from "@/stores/navStore";

/** 마우스 X1(뒤로) 버튼 */
const MOUSE_BACK_BUTTON = 3;
/** 마우스 X2(앞으로) 버튼 */
const MOUSE_FORWARD_BUTTON = 4;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest('[contenteditable="true"]') != null;
}

/**
 * 백스페이스·마우스 뒤로/앞으로 버튼으로 네비 히스토리를 이동한다.
 * App 등 최상단에서 한 번만 호출하면 모든 페이지에 적용된다.
 */
export function useGlobalBackNavigation() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const didGoBack = useNavStore.getState().goBack();
      if (didGoBack) {
        event.preventDefault();
      }
    }

    function handleMouseNav(event: MouseEvent) {
      if (event.button === MOUSE_BACK_BUTTON) {
        const didGoBack = useNavStore.getState().goBack();
        if (didGoBack) {
          event.preventDefault();
        }
        return;
      }

      if (event.button === MOUSE_FORWARD_BUTTON) {
        const didGoForward = useNavStore.getState().goForward();
        if (didGoForward) {
          event.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    // mousedown에서만 처리해 mouseup/auxclick 중복 이동을 막는다.
    window.addEventListener("mousedown", handleMouseNav);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseNav);
    };
  }, []);
}
