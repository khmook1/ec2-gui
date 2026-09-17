export const queryKeys = {
  appInfo: ["appInfo"] as const,
  storagePaths: ["settings", "storagePaths"] as const,

  dockerInstalled: (session: string) =>
    ["docker", "installed", session] as const,
  dockerContainers: (session: string) =>
    ["docker", "containers", session] as const,
  dockerImages: (session: string) => ["docker", "images", session] as const,
  dockerVolumes: (session: string) => ["docker", "volumes", session] as const,
  dockerNetworks: (session: string) => ["docker", "networks", session] as const,
  dockerContainerDetails: (session: string, containerId: string) =>
    ["docker", "containerDetails", session, containerId] as const,
  dockerContainerLogs: (
    session: string,
    containerId: string,
    tail: number,
    since: string,
  ) => ["docker", "containerLogs", session, containerId, tail, since] as const,

  diskOverview: (session: string) => ["dashboard", "disk", session] as const,
  systemResources: (session: string) =>
    ["dashboard", "system", session] as const,
  sshSessions: (session: string) =>
    ["dashboard", "sshSessions", session] as const,
  permissions: (session: string) =>
    ["dashboard", "permissions", session] as const,

  remoteHome: (session: string) => ["fs", "home", session] as const,
  remoteDir: (session: string, path: string) =>
    ["fs", "dir", session, path] as const,
  remoteFile: (session: string, path: string) =>
    ["fs", "file", session, path] as const,
} as const;
