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

/** macOS `memory_pressure` 요약 */
export interface MemoryPressureInfo {
  /** `normal` | `warn` | `critical` | `unknown` */
  level: string;
  freePercent?: number | null;
}

export interface HostInfo {
  model: string;
  osVersion: string;
  uptimeSeconds: number;
}

export interface SystemResources {
  cpu: CpuResource;
  memory: MemoryResource;
  network: NetworkResource;
  memoryPressure?: MemoryPressureInfo | null;
  host?: HostInfo | null;
}
