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

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "ico",
  "svg",
]);

/** 앱에서 미리보기를 지원하지 않는 이진/미디어/아카이브 확장자 */
const UNVIEWABLE_EXTENSIONS = new Set([
  "7z",
  "a",
  "aac",
  "apk",
  "avi",
  "bin",
  "bz2",
  "class",
  "dat",
  "deb",
  "dll",
  "dmg",
  "doc",
  "docx",
  "dylib",
  "ear",
  "exe",
  "flac",
  "flv",
  "gz",
  "iso",
  "jar",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "msi",
  "o",
  "obj",
  "ogg",
  "otf",
  "pdf",
  "pkg",
  "ppt",
  "pptx",
  "pyc",
  "pyo",
  "rar",
  "rpm",
  "so",
  "tar",
  "tgz",
  "ttf",
  "war",
  "wasm",
  "wav",
  "webm",
  "woff",
  "woff2",
  "xls",
  "xlsx",
  "xz",
  "zip",
]);

export type ExplorerFileIconKind = "folder" | "image" | "unviewable" | "file";

function getFileExtension(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension || extension === name.toLowerCase()) {
    return null;
  }
  return extension;
}

export function isImageFileName(name: string): boolean {
  const extension = getFileExtension(name);
  return extension != null && IMAGE_EXTENSIONS.has(extension);
}

export function isUnviewableFileName(name: string): boolean {
  if (isImageFileName(name)) {
    return false;
  }
  const extension = getFileExtension(name);
  return extension != null && UNVIEWABLE_EXTENSIONS.has(extension);
}

export function getExplorerFileIconKind(
  isDirectory: boolean,
  name: string,
): ExplorerFileIconKind {
  if (isDirectory) {
    return "folder";
  }
  if (isImageFileName(name)) {
    return "image";
  }
  if (isUnviewableFileName(name)) {
    return "unviewable";
  }
  return "file";
}

export function getEntryKindLabel(isDirectory: boolean, name?: string): string {
  if (isDirectory) {
    return "폴더";
  }
  if (!name) {
    return "파일";
  }
  switch (getExplorerFileIconKind(false, name)) {
    case "image":
      return "이미지";
    case "unviewable":
      return "미리보기 불가";
    default:
      return "파일";
  }
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
