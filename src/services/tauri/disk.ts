import { invoke } from "@tauri-apps/api/core";
import type { DiskOverview, LargeDirectory } from "@/types/disk";
import type { DiskUsageSample } from "@/lib/diskUsageHistory";
import type { RemotePermissionOverview } from "@/types/permissions";
import type { RemoteSshSession } from "@/types/sshSession";
import type { SystemResources } from "@/types/system";

export async function getRemoteDiskOverview(): Promise<DiskOverview> {
  return invoke<DiskOverview>("get_remote_disk_overview");
}

export async function getRemoteLargeDirectories(): Promise<LargeDirectory[]> {
  return invoke<LargeDirectory[]>("get_remote_large_directories");
}

export async function getRemoteSystemResources(): Promise<SystemResources> {
  return invoke<SystemResources>("get_remote_system_resources");
}

export async function listRemoteSshSessions(): Promise<RemoteSshSession[]> {
  return invoke<RemoteSshSession[]>("list_remote_ssh_sessions");
}

export async function getRemotePermissionOverview(): Promise<RemotePermissionOverview> {
  return invoke<RemotePermissionOverview>("get_remote_permission_overview");
}

export async function ensureRemoteDiskHistory(): Promise<void> {
  return invoke("ensure_remote_disk_history");
}

export async function getRemoteDiskHistory(): Promise<DiskUsageSample[]> {
  return invoke<DiskUsageSample[]>("get_remote_disk_history");
}
