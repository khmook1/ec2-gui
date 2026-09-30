import { create } from "zustand";

export interface ExplorerNavTarget {
  directory: string;
  /** 디렉터리를 연 뒤 선택할 항목 경로 */
  selectPath?: string;
}

interface ExplorerNavState {
  /** 파일 탐색기가 다음 마운트 시 열 위치 */
  pendingTarget: ExplorerNavTarget | null;
  setPendingTarget: (target: ExplorerNavTarget) => void;
  clearPendingTarget: () => void;
}

export const useExplorerNavStore = create<ExplorerNavState>((set) => ({
  pendingTarget: null,
  setPendingTarget: (pendingTarget) => set({ pendingTarget }),
  clearPendingTarget: () => set({ pendingTarget: null }),
}));
