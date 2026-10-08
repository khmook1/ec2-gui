import { invoke } from "@tauri-apps/api/core";

export interface AppStoragePaths {
  appData: string;
  settingsFile: string;
  favoritesFile: string;
  loginHistoryFile: string;
  serverHistory: string;
  wallpapers: string;
  cache: string;
  logs: string;
  webviewData: string;
}

export type StorageLocation = keyof AppStoragePaths;

export async function getStoragePaths(): Promise<AppStoragePaths> {
  return invoke<AppStoragePaths>("get_storage_paths");
}

export async function openStorageLocation(
  location: StorageLocation,
): Promise<void> {
  return invoke("open_storage_location", { location });
}

export async function clearAppCache(): Promise<void> {
  return invoke("clear_app_cache");
}

export async function setWallpaperImage(sourcePath: string): Promise<string> {
  return invoke<string>("set_wallpaper_image", { sourcePath });
}

export async function clearWallpaperImage(): Promise<void> {
  return invoke("clear_wallpaper_image");
}
