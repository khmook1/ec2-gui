export type RemoteOs = "linux" | "macos" | "windows" | "unknown";

export interface DiskFilesystem {
  filesystem: string;
  sizeBytes: number;
  usedBytes: number;
  availableBytes: number;
  usePercent: number;
  mountedOn: string;
}

export interface LargeDirectory {
  path: string;
  sizeBytes: number;
}

export interface DiskOverview {
  /** 원격 호스트 OS (`uname -s`) */
  os: RemoteOs;
  filesystems: DiskFilesystem[];
  largeDirectories: LargeDirectory[];
}
