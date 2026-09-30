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

/** 원격 `~/.ec2-gui/resource-history` 일별 파일의 샘플 (사용률 %) */
export interface ResourceHistorySample {
  ts: number;
  cpu: number;
  memory: number;
  disk: number | null;
}

export interface ResourceHistoryDays {
  /** 원격 서버 로컬 기준 오늘 (`YYYY-MM-DD`) */
  today: string;
  /** 원격 서버 UTC 오프셋(분) */
  utcOffsetMinutes: number;
  /** 저장된 날짜 (오래된 순, 최대 30개) */
  days: string[];
}

export interface SystemResources {
  cpu: CpuResource;
  memory: MemoryResource;
  network: NetworkResource;
  memoryPressure?: MemoryPressureInfo | null;
  host?: HostInfo | null;
}
