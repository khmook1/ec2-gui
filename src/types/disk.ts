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

export interface BlockDevice {
  name: string;
  path: string;
  sizeBytes: number;
  type: string;
  mountpoint: string | null;
  fstype: string | null;
  pkname: string | null;
  children: BlockDevice[];
}

export interface DiskExpandStatus {
  devices: BlockDevice[];
  rootDevice: string | null;
  rootPartition: string | null;
  rootFstype: string | null;
  rootMount: string | null;
  diskSizeBytes: number;
  unallocatedBytes: number;
  currentSizeGb: number;
  volumeId: string | null;
  instanceId: string | null;
  region: string | null;
  canGrowOs: boolean;
  canModifyEbs: boolean;
  requiresSudo: boolean;
  hasPrivilegedAccess: boolean;
  awsCliAvailable: boolean;
  growpartAvailable: boolean;
  notes: string[];
}

export interface DiskExpandStep {
  name: string;
  ok: boolean;
  output: string;
}

export interface DiskExpandResult {
  success: boolean;
  steps: DiskExpandStep[];
  message: string;
}
