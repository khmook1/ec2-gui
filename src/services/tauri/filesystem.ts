import { invoke } from "@tauri-apps/api/core";
import type {
  RemoteDirectoryListing,
  RemoteFileContent,
} from "@/types/filesystem";

export async function getRemoteHome(): Promise<string> {
  return invoke<string>("get_remote_home");
}

export async function listRemoteDirectory(
  path: string,
): Promise<RemoteDirectoryListing> {
  return invoke<RemoteDirectoryListing>("list_remote_directory", { path });
}

export async function createRemoteDirectory(path: string): Promise<void> {
  return invoke("create_remote_directory", { path });
}

export async function createRemoteFile(path: string): Promise<void> {
  return invoke("create_remote_file", { path });
}

export async function deleteRemotePath(path: string): Promise<void> {
  return invoke("delete_remote_path", { path });
}

export async function readRemoteFile(path: string): Promise<RemoteFileContent> {
  return invoke<RemoteFileContent>("read_remote_file", { path });
}

export async function writeRemoteFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke("write_remote_file", { path, content });
}
