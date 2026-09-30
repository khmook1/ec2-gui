export const queryKeys = {
  appInfo: ["appInfo"] as const,
  storagePaths: ["settings", "storagePaths"] as const,

  dockerInstalled: (session: string) =>
    ["docker", "installed", session] as const,
  dockerContainers: (session: string) =>
    ["docker", "containers", session] as const,
  dockerFavorites: (session: string) =>
    ["docker", "favorites", session] as const,
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
  dockerOverview: (session: string) =>
    ["docker", "overview", session] as const,
  dockerImageInspect: (session: string, imageRef: string) =>
    ["docker", "imageInspect", session, imageRef] as const,
  dockerImageHistory: (session: string, imageRef: string) =>
    ["docker", "imageHistory", session, imageRef] as const,
  dockerVolumeInspect: (session: string, volumeName: string) =>
    ["docker", "volumeInspect", session, volumeName] as const,
  dockerNetworkInspect: (session: string, networkRef: string) =>
    ["docker", "networkInspect", session, networkRef] as const,
  dockerSystemOutput: (session: string, action: string) =>
    ["docker", "systemOutput", session, action] as const,

  diskOverview: (session: string) => ["dashboard", "disk", session] as const,
  largeDirectories: (session: string) =>
    ["dashboard", "largeDirectories", session] as const,
  diskHistory: (session: string) =>
    ["dashboard", "diskHistory", session] as const,
  diskHistoryCollector: (session: string) =>
    ["dashboard", "diskHistoryCollector", session] as const,
  blockDevices: (session: string) =>
    ["dashboard", "blockDevices", session] as const,
  diskExpandStatus: (session: string) =>
    ["dashboard", "diskExpandStatus", session] as const,
  systemResources: (session: string) =>
    ["dashboard", "system", session] as const,
  resourceHistoryCollector: (session: string) =>
    ["dashboard", "resourceHistoryCollector", session] as const,
  resourceHistoryDays: (session: string) =>
    ["dashboard", "resourceHistoryDays", session] as const,
  resourceHistory: (session: string, date: string) =>
    ["dashboard", "resourceHistory", session, date] as const,
  sshSessions: (session: string) =>
    ["dashboard", "sshSessions", session] as const,
  permissions: (session: string) =>
    ["dashboard", "permissions", session] as const,
  remoteUsers: (session: string) =>
    ["permissions", "users", session] as const,
  remoteGroups: (session: string) =>
    ["permissions", "groups", session] as const,

  remoteHome: (session: string) => ["fs", "home", session] as const,
  remoteDir: (session: string, path: string) =>
    ["fs", "dir", session, path] as const,
  remoteFile: (session: string, path: string) =>
    ["fs", "file", session, path] as const,
  remoteFavorites: (session: string) => ["fs", "favorites", session] as const,
} as const;
