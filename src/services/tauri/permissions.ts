import { invoke } from "@tauri-apps/api/core";
import type {
  CreateRemoteUserInput,
  RemoteUser,
} from "@/types/permissions";

export async function listRemoteUsers(): Promise<RemoteUser[]> {
  return invoke<RemoteUser[]>("list_remote_users");
}

export async function listRemoteGroups(): Promise<string[]> {
  return invoke<string[]>("list_remote_groups");
}

export async function addRemoteUserGroup(
  username: string,
  group: string,
): Promise<void> {
  return invoke("add_remote_user_group", { username, group });
}

export async function removeRemoteUserGroup(
  username: string,
  group: string,
): Promise<void> {
  return invoke("remove_remote_user_group", { username, group });
}

export async function setRemoteUserPasswordlessSudo(
  username: string,
  enabled: boolean,
): Promise<void> {
  return invoke("set_remote_user_passwordless_sudo", { username, enabled });
}

export async function createRemoteUser(
  input: CreateRemoteUserInput,
): Promise<void> {
  return invoke("create_remote_user", { input });
}

export async function deleteRemoteUser(
  username: string,
  removeHome: boolean,
): Promise<void> {
  return invoke("delete_remote_user", { username, removeHome });
}
