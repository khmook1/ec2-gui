import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";

interface ListSelectionContextValue {
  selectedKey: string | null;
  select: (key: string) => void;
  clearSelection: () => void;
}

const ListSelectionContext = createContext<ListSelectionContextValue | null>(
  null,
);

interface ListSelectionProviderProps {
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  children: ReactNode;
}

/**
 * 테이블/GUI 공통 선택 동작:
 * - 항목 클릭: 선택
 * - 항목 더블클릭: 페이지에서 open 처리
 * - 빈 영역 클릭: 선택 해제
 */
export function ListSelectionProvider({
  selectedKey,
  onSelectedKeyChange,
  children,
}: ListSelectionProviderProps) {
  const select = useCallback(
    (key: string) => {
      onSelectedKeyChange(key);
    },
    [onSelectedKeyChange],
  );

  const clearSelection = useCallback(() => {
    onSelectedKeyChange(null);
  }, [onSelectedKeyChange]);

  const value = useMemo(
    () => ({ selectedKey, select, clearSelection }),
    [selectedKey, select, clearSelection],
  );

  return (
    <ListSelectionContext.Provider value={value}>
      {children}
    </ListSelectionContext.Provider>
  );
}

export function useListSelection(): ListSelectionContextValue {
  const context = useContext(ListSelectionContext);
  if (!context) {
    throw new Error(
      "useListSelection must be used within ListSelectionProvider",
    );
  }
  return context;
}

export function useOptionalListSelection(): ListSelectionContextValue | null {
  return useContext(ListSelectionContext);
}

interface ListSelectionSurfaceProps {
  children: ReactNode;
  className?: string;
}

/** 빈 영역 클릭 시 선택을 해제하는 컨테이너 */
export function ListSelectionSurface({
  children,
  className,
}: ListSelectionSurfaceProps) {
  const { clearSelection } = useListSelection();

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      clearSelection();
    }
  }

  return (
    <div className={className} onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
}
