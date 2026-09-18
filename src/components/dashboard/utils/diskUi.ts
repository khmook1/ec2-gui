import type { DiskFilesystem, RemoteOs } from "@/types/disk";
import { formatFileSize } from "@/utils/file";

export type DiskUsageTone = "success" | "warning" | "danger" | "neutral";

export function toneForPercent(percent: number): DiskUsageTone {
  if (percent >= 90) {
    return "danger";
  }
  if (percent >= 75) {
    return "warning";
  }
  return "success";
}

export function pickPrimaryFilesystem(
  filesystems: DiskFilesystem[],
  os?: RemoteOs | null,
): DiskFilesystem | null {
  if (os === "macos") {
    return (
      filesystems.find((fs) => fs.mountedOn === "/System/Volumes/Data") ??
      filesystems.find((fs) => fs.mountedOn === "/") ??
      filesystems[0] ??
      null
    );
  }

  return (
    filesystems.find((fs) => fs.mountedOn === "/") ??
    filesystems.find((fs) => fs.mountedOn === "/System/Volumes/Data") ??
    filesystems[0] ??
    null
  );
}

export function formatDiskUsageLine(fs: DiskFilesystem): string {
  return `${formatFileSize(fs.usedBytes)} / ${formatFileSize(fs.sizeBytes)}`;
}
