export type AppRuntimeStatus = "idle" | "loading" | "ready" | "error";

export interface AppInfo {
  name: string;
  version: string;
}

export interface ApiError {
  message: string;
  status?: number;
}
