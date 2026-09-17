export type ConnectionStatus =
  "disconnected" | "connecting" | "connected" | "error";

export type SshAuthMethod = "pem" | "password";

export interface SshCredentials {
  host: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
  privateKeyPath?: string;
  keyPassphrase?: string;
  password?: string;
}

export interface SshConnectionInfo {
  host: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
}

export interface SshConnectResult {
  host: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
}
