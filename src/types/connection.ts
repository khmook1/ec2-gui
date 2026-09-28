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
  /** 백엔드 다중 연결 식별자 */
  connectionId?: string;
}

export interface SshConnectResult {
  connectionId: string;
  host: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
}
