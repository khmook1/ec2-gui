import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./css/context-menu.css";

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface OpenContextMenuOptions {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuContextValue {
  openContextMenu: (options: OpenContextMenuOptions) => void;
  closeContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

const MENU_VIEWPORT_PADDING = 8;

function clampMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
): { x: number; y: number } {
  const maxX = window.innerWidth - menuWidth - MENU_VIEWPORT_PADDING;
  const maxY = window.innerHeight - menuHeight - MENU_VIEWPORT_PADDING;
  return {
    x: Math.max(MENU_VIEWPORT_PADDING, Math.min(x, maxX)),
    y: Math.max(MENU_VIEWPORT_PADDING, Math.min(y, maxY)),
  };
}

function ContextMenuOverlay({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const rect = menu.getBoundingClientRect();
    setPosition(clampMenuPosition(state.x, state.y, rect.width, rect.height));
  }, [state.x, state.y, state.items]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleViewportChange() {
      onClose();
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {state.items.map((item) => (
        <div key={item.id} className="context-menu__group">
          {item.separatorBefore ? (
            <div className="context-menu__separator" role="separator" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={[
              "context-menu__item",
              item.danger ? "context-menu__item--danger" : "",
              item.disabled ? "context-menu__item--disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState | null>(null);

  const closeContextMenu = useCallback(() => {
    setState(null);
  }, []);

  const openContextMenu = useCallback((options: OpenContextMenuOptions) => {
    if (options.items.length === 0) {
      setState(null);
      return;
    }
    setState({
      x: options.x,
      y: options.y,
      items: options.items,
    });
  }, []);

  const value = useMemo(
    () => ({ openContextMenu, closeContextMenu }),
    [openContextMenu, closeContextMenu],
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {state ? (
        <ContextMenuOverlay state={state} onClose={closeContextMenu} />
      ) : null}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu(): ContextMenuContextValue {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within ContextMenuProvider");
  }
  return context;
}
