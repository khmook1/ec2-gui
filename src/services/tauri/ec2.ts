import { invoke } from "@tauri-apps/api/core";
import type { Ec2ConnectResult, Ec2Credentials } from "@/types/connection";

export async function connectEc2(
  credentials: Ec2Credentials,
): Promise<Ec2ConnectResult> {
  return invoke<Ec2ConnectResult>("connect_ec2", {
    host: credentials.host,
    username: credentials.username,
    port: credentials.port,
    authMethod: credentials.authMethod,
    privateKeyPath: credentials.privateKeyPath ?? null,
    keyPassphrase: credentials.keyPassphrase ?? null,
    password: credentials.password ?? null,
  });
}

export async function disconnectEc2(): Promise<void> {
  await invoke<void>("disconnect_ec2");
}
