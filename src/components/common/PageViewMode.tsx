import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageViewMode = "tableList" | "gui";

interface PageViewModeContextValue {
  viewMode: PageViewMode;
  setViewMode: (mode: PageViewMode) => void;
}

const PageViewModeContext = createContext<PageViewModeContextValue | null>(
  null,
);

interface PageViewModeProviderProps {
  children: ReactNode;
  defaultViewMode?: PageViewMode;
}

/**
 * 페이지에 테이블/GUI 이중 보기가 있을 때 감싼다.
 * 하위의 PageToolbar는 이 Provider가 있으면 보기 토글을 표시한다.
 */
export function PageViewModeProvider({
  children,
  defaultViewMode = "gui",
}: PageViewModeProviderProps) {
  const [viewMode, setViewMode] = useState<PageViewMode>(defaultViewMode);
  const value = useMemo(
    () => ({ viewMode, setViewMode }),
    [viewMode],
  );

  return (
    <PageViewModeContext.Provider value={value}>
      {children}
    </PageViewModeContext.Provider>
  );
}

export function usePageViewMode(): PageViewModeContextValue {
  const context = useContext(PageViewModeContext);
  if (!context) {
    throw new Error("usePageViewMode must be used within PageViewModeProvider");
  }
  return context;
}

export function useOptionalPageViewMode(): PageViewModeContextValue | null {
  return useContext(PageViewModeContext);
}

interface PageViewSwitchProps {
  tableList: ReactNode;
  gui: ReactNode;
}

/** Provider 아래서 현재 보기 모드에 맞는 자식을 렌더한다. */
export function PageViewSwitch({ tableList, gui }: PageViewSwitchProps) {
  const { viewMode } = usePageViewMode();
  return <>{viewMode === "gui" ? gui : tableList}</>;
}
