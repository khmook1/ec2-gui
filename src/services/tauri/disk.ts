import { invoke } from "@tauri-apps/api/core";
import type { DiskOverview } from "@/types/disk";

export function getRemoteDiskOverview(): Promise<DiskOverview> {
  return invoke<DiskOverview>("get_remote_disk_overview");
}
