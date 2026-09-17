export interface CpuResource {
  cores: number;
  load1: number;
  usePercent: number;
}

export interface MemoryResource {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usePercent: number;
}

export interface NetworkResource {
  interface: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
}

export interface SystemResources {
  cpu: CpuResource;
  memory: MemoryResource;
  network: NetworkResource;
}
