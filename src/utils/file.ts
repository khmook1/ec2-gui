export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatModifiedTime(timestamp: number | null): string {
  if (timestamp === null || timestamp <= 0) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

export function getEntryKindLabel(isDirectory: boolean): string {
  return isDirectory ? "폴더" : "파일";
}

export function splitPathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

export function buildPathFromSegments(segments: string[]): string {
  if (segments.length === 0) {
    return "/";
  }
  return `/${segments.join("/")}`;
}

export function joinRemotePath(base: string, name: string): string {
  const trimmedName = name.trim();
  if (base === "/" || base === "") {
    return `/${trimmedName}`;
  }
  return `${base.replace(/\/+$/, "")}/${trimmedName}`;
}

export function isValidRemoteEntryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return false;
  }
  return !trimmed.includes("/") && !trimmed.includes("\\");
}
