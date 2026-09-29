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

export interface RemoteUser {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  groups: string[];
  hasSudoGroup: boolean;
  hasDockerGroup: boolean;
  /** sudoers 어디서든 NOPASSWD 적용 여부 */
  nopasswdSudo: boolean;
  /** 앱이 만든 sudoers.d 파일로 부여된 NOPASSWD */
  managedSudo: boolean;
  isCurrent: boolean;
}

export interface CreateRemoteUserInput {
  username: string;
  shell?: string | null;
  groups: string[];
  sshPublicKey?: string | null;
}
