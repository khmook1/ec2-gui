import type { SshConnectionInfo } from "@/types/connection";

export function getSessionKey(connection: SshConnectionInfo): string {
  if (connection.connectionId) {
    return connection.connectionId;
  }
  return `${connection.host}:${connection.port}:${connection.username}`;
}
