import { create } from "zustand";
import { ROUTE_ID } from "@/config/Route";
import { useNavStore } from "@/stores/navStore";

interface GitHubState {
  /** 상세 페이지에서 보고 있는 저장소 (`owner/name`) */
  selectedRepo: string | null;
  openRepo: (fullName: string) => void;
}

export const useGitHubStore = create<GitHubState>((set) => ({
  selectedRepo: null,
  openRepo: (fullName) => {
    set({ selectedRepo: fullName });
    useNavStore.getState().setActiveId(ROUTE_ID.githubRepo);
  },
}));
