export function getAppName(): string {
  const name = import.meta.env.VITE_APP_NAME?.trim();
  return name || "App";
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
}
