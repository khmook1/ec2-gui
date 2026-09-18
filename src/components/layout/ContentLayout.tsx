import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ContextMenuProvider } from "@/providers/ContextMenuProvider";
import { ListSearchProvider } from "@/providers/ListSearchProvider";
import "./css/content-layout.css";

interface ContentLayoutProps {
  children: ReactNode;
}

function getScrollableOverflow(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    el.scrollHeight > el.clientHeight + 1
  );
}

export function ContentLayout({ children }: ContentLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const refreshEdgeFade = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }

    let top = false;
    let bottom = false;
    const nodes = root.querySelectorAll<HTMLElement>("*");
    for (const el of nodes) {
      if (!getScrollableOverflow(el)) {
        continue;
      }
      if (el.scrollTop > 2) {
        top = true;
      }
      if (el.scrollTop + el.clientHeight < el.scrollHeight - 2) {
        bottom = true;
      }
      if (top && bottom) {
        break;
      }
    }
    setShowTopFade(top);
    setShowBottomFade(bottom);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    let rafId = 0;
    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(refreshEdgeFade);
    };

    schedule();
    root.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(rafId);
      root.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [refreshEdgeFade]);

  return (
    <div className="content-layout" ref={rootRef}>
      <ContextMenuProvider>
        <ListSearchProvider>{children}</ListSearchProvider>
      </ContextMenuProvider>
      <div
        className={[
          "content-layout__edge-fade",
          "content-layout__edge-fade--top",
          showTopFade ? "content-layout__edge-fade--visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      />
      <div
        className={[
          "content-layout__edge-fade",
          "content-layout__edge-fade--bottom",
          showBottomFade ? "content-layout__edge-fade--visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      />
    </div>
  );
}
