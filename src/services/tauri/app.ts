import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, LocalLoginDefaults } from "@/types/app";

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export async function getLocalLoginDefaults(): Promise<LocalLoginDefaults> {
  return invoke<LocalLoginDefaults>("get_local_login_defaults");
}
