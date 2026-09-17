import { invoke } from "@tauri-apps/api/core";
import type { SshConnectResult, SshCredentials } from "@/types/connection";

export async function connectSsh(
  credentials: SshCredentials,
): Promise<SshConnectResult> {
  return invoke<SshConnectResult>("connect_ssh", {
    host: credentials.host,
    username: credentials.username,
    port: credentials.port,
    authMethod: credentials.authMethod,
    privateKeyPath: credentials.privateKeyPath ?? null,
    keyPassphrase: credentials.keyPassphrase ?? null,
    password: credentials.password ?? null,
  });
}

export async function disconnectSsh(): Promise<void> {
  await invoke<void>("disconnect_ssh");
}
