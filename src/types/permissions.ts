export type SudoAccess = "none" | "group" | "passwordless" | "root";

export interface RemotePermissionOverview {
  username: string;
  uid: number;
  primaryGroup: string;
  groups: string[];
  home: string;
  isRoot: boolean;
  sudo: SudoAccess;
  dockerAccess: boolean;
  canWriteHome: boolean;
}
