export interface RemoteEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number | null;
}

export interface RemoteDirectoryListing {
  path: string;
  entries: RemoteEntry[];
}

export interface RemoteFileContent {
  path: string;
  name: string;
  size: number;
  content: string;
  truncated: boolean;
  isBinary: boolean;
  isImage: boolean;
}
