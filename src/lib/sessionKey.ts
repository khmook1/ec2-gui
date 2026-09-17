import type { SshConnectionInfo } from "@/types/connection";

export function getSessionKey(connection: SshConnectionInfo): string {
  return `${connection.host}:${connection.port}:${connection.username}`;
}
