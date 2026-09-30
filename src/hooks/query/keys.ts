import type { GitHubRepoQuery } from "@/types/github";

export const queryKeys = {
  appInfo: ["appInfo"] as const,
  storagePaths: ["settings", "storagePaths"] as const,
  githubViewer: ["github", "viewer"] as const,
  githubRepos: (query: GitHubRepoQuery) =>
    [
      "github",
      "repos",
      query.affiliation,
      query.visibility,
      query.keyword,
      query.perPage,
      query.page,
    ] as const,
  /** 저장소 단위 무효화용 접두 키 */
  githubRepoScope: (repo: string) => ["github", "repo", repo] as const,
  githubRepo: (repo: string) => ["github", "repo", repo, "detail"] as const,
  githubLanguages: (repo: string) =>
    ["github", "repo", repo, "languages"] as const,
  githubReadme: (repo: string, gitRef: string | null) =>
    ["github", "repo", repo, "readme", gitRef] as const,
  githubContents: (repo: string, path: string, gitRef: string | null) =>
    ["github", "repo", repo, "contents", gitRef, path] as const,
  githubFile: (repo: string, path: string, gitRef: string | null) =>
    ["github", "repo", repo, "file", gitRef, path] as const,
  githubBranchesScope: (repo: string) =>
    ["github", "repo", repo, "branches"] as const,
  githubBranches: (repo: string, page: number, perPage: number) =>
    ["github", "repo", repo, "branches", perPage, page] as const,
  githubIssuesScope: (repo: string) =>
    ["github", "repo", repo, "issues"] as const,
  githubIssues: (repo: string, state: string, page: number) =>
    ["github", "repo", repo, "issues", "list", state, page] as const,
  githubIssue: (repo: string, number: number) =>
    ["github", "repo", repo, "issues", "detail", number] as const,
  githubComments: (repo: string, number: number, page: number) =>
    ["github", "repo", repo, "comments", number, page] as const,
  githubCommentsScope: (repo: string, number: number) =>
    ["github", "repo", repo, "comments", number] as const,
  githubPullsScope: (repo: string) =>
    ["github", "repo", repo, "pulls"] as const,
  githubPulls: (repo: string, state: string, page: number) =>
    ["github", "repo", repo, "pulls", "list", state, page] as const,
  githubPull: (repo: string, number: number) =>
    ["github", "repo", repo, "pulls", "detail", number] as const,

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
