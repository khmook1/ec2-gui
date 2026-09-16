import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SshTerminalDataPayload {
  shellId: string;
  data: string;
}

export interface SshTerminalClosedPayload {
  shellId: string;
}

export async function openSshShell(cols: number, rows: number): Promise<string> {
  return invoke<string>("open_ssh_shell", { cols, rows });
}

export async function writeSshShell(
  shellId: string,
  data: string,
): Promise<void> {
  await invoke<void>("write_ssh_shell", { shellId, data });
}

export async function resizeSshShell(
  shellId: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke<void>("resize_ssh_shell", { shellId, cols, rows });
}

export async function closeSshShell(shellId: string): Promise<void> {
  await invoke<void>("close_ssh_shell", { shellId });
}

export async function closeAllSshShells(): Promise<void> {
  await invoke<void>("close_all_ssh_shells");
}

export function listenSshTerminalData(
  handler: (payload: SshTerminalDataPayload) => void,
): Promise<UnlistenFn> {
  return listen<SshTerminalDataPayload>("ssh-terminal-data", (event) => {
    handler(event.payload);
  });
}

export function listenSshTerminalClosed(
  handler: (payload: SshTerminalClosedPayload) => void,
): Promise<UnlistenFn> {
  return listen<SshTerminalClosedPayload>("ssh-terminal-closed", (event) => {
    handler(event.payload);
  });
}
