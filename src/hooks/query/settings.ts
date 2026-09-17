import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query/keys";
import {
  clearAppCache,
  clearWallpaperImage,
  getStoragePaths,
  setWallpaperImage,
} from "@/services/tauri/settings";

export function useStoragePathsQuery() {
  return useQuery({
    queryKey: queryKeys.storagePaths,
    queryFn: getStoragePaths,
  });
}

export function useClearAppCacheMutation() {
  return useMutation({
    mutationFn: clearAppCache,
  });
}

export function useSetWallpaperImageMutation() {
  return useMutation({
    mutationFn: (sourcePath: string) => setWallpaperImage(sourcePath),
  });
}

export function useClearWallpaperImageMutation() {
  return useMutation({
    mutationFn: clearWallpaperImage,
  });
}
