import { invoke } from "@tauri-apps/api/core";
import type { DiskOverview } from "@/types/disk";
import type { RemotePermissionOverview } from "@/types/permissions";
import type { RemoteSshSession } from "@/types/sshSession";
import type { SystemResources } from "@/types/system";

export function getRemoteDiskOverview(): Promise<DiskOverview> {
  return invoke<DiskOverview>("get_remote_disk_overview");
}

export function getRemoteSystemResources(): Promise<SystemResources> {
  return invoke<SystemResources>("get_remote_system_resources");
}

export function listRemoteSshSessions(): Promise<RemoteSshSession[]> {
  return invoke<RemoteSshSession[]>("list_remote_ssh_sessions");
}

export function getRemotePermissionOverview(): Promise<RemotePermissionOverview> {
  return invoke<RemotePermissionOverview>("get_remote_permission_overview");
}
