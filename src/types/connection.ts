export type ConnectionStatus =
  "disconnected" | "connecting" | "connected" | "error";

export type Ec2AuthMethod = "pem" | "password";

export interface Ec2Credentials {
  host: string;
  username: string;
  port: number;
  authMethod: Ec2AuthMethod;
  privateKeyPath?: string;
  keyPassphrase?: string;
  password?: string;
}

export interface Ec2ConnectionInfo {
  host: string;
  username: string;
  port: number;
  authMethod: Ec2AuthMethod;
}

export interface Ec2ConnectResult {
  host: string;
  username: string;
  port: number;
  authMethod: Ec2AuthMethod;
}
