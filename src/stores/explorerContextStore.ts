import { create } from "zustand";

/** AI에 전달하는 파일 탐색기 위치 */
export interface ExplorerContext {
  currentPath: string;
  selectedPath: string | null;
  /** 미리보기·편집 다이얼로그로 열어 둔 파일 */
  openFile: string | null;
}

interface ExplorerContextState {
  context: ExplorerContext | null;
  setContext: (context: ExplorerContext | null) => void;
}

export const useExplorerContextStore = create<ExplorerContextState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}));
