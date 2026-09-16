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
  filesystems: DiskFilesystem[];
  largeDirectories: LargeDirectory[];
}
