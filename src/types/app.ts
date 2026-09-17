export type AppRuntimeStatus = "idle" | "loading" | "ready" | "error";

export interface AppInfo {
  name: string;
  version: string;
}

export interface LocalLoginDefaults {
  available: boolean;
  host: string;
  port: number;
  username: string;
  memo: string;
}

export interface ApiError {
  message: string;
  status?: number;
}
