import type { Ec2AuthMethod, Ec2Credentials } from "@/types/connection";

const STORAGE_KEY = "ec2-gui-login-cache";
const SKIP_AUTO_LOGIN_SESSION_KEY = "ec2-gui-skip-auto-login";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY = 8;

export interface CachedLoginForm {
  host: string;
  username: string;
  port: number;
  authMethod: Ec2AuthMethod;
  privateKeyPath: string;
  keyPassphrase: string;
  password: string;
}

export interface CachedLoginHistoryEntry extends CachedLoginForm {
  id: string;
  savedAt: number;
}

interface LoginCachePayload {
  savedAt: number;
  host: string;
  username: string;
  port: number;
  authMethod: Ec2AuthMethod;
  privateKeyPath?: string;
  keyPassphrase?: string;
  password?: string;
}

function isAuthMethod(value: unknown): value is Ec2AuthMethod {
  return value === "pem" || value === "password";
}

function parseCachePayload(value: unknown): LoginCachePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<LoginCachePayload>;
  if (
    typeof parsed.savedAt !== "number" ||
    typeof parsed.host !== "string" ||
    typeof parsed.username !== "string" ||
    typeof parsed.port !== "number" ||
    !isAuthMethod(parsed.authMethod)
  ) {
    return null;
  }

  return {
    savedAt: parsed.savedAt,
    host: parsed.host,
    username: parsed.username,
    port: parsed.port,
    authMethod: parsed.authMethod,
    privateKeyPath: parsed.privateKeyPath,
    keyPassphrase: parsed.keyPassphrase,
    password: parsed.password,
  };
}

function payloadToForm(payload: LoginCachePayload): CachedLoginForm {
  return {
    host: payload.host,
    username: payload.username,
    port: payload.port,
    authMethod: payload.authMethod,
    privateKeyPath: payload.privateKeyPath ?? "",
    keyPassphrase: payload.keyPassphrase ?? "",
    password: payload.password ?? "",
  };
}

function payloadToHistoryEntry(
  payload: LoginCachePayload,
): CachedLoginHistoryEntry {
  return {
    ...payloadToForm(payload),
    id: makeHistoryId(payload),
    savedAt: payload.savedAt,
  };
}

export function makeHistoryId(
  entry: Pick<
    LoginCachePayload,
    "host" | "username" | "port" | "authMethod"
  >,
): string {
  return [
    entry.host.trim().toLowerCase(),
    entry.username.trim().toLowerCase(),
    String(entry.port),
    entry.authMethod,
  ].join("|");
}

function isFresh(savedAt: number): boolean {
  return Date.now() - savedAt <= TTL_MS;
}

function readRawPayloads(): LoginCachePayload[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => parseCachePayload(item))
        .filter((item): item is LoginCachePayload => item !== null);
    }

    const single = parseCachePayload(parsed);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

function writePayloads(payloads: LoginCachePayload[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (payloads.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payloads));
}

export function loadLoginHistory(): CachedLoginHistoryEntry[] {
  const fresh = readRawPayloads().filter((item) => isFresh(item.savedAt));
  writePayloads(fresh);
  return fresh.map(payloadToHistoryEntry);
}

export function loadLoginCache(): CachedLoginForm | null {
  const history = loadLoginHistory();
  return history[0] ?? null;
}

export function saveLoginCache(credentials: Ec2Credentials): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const nextPayload: LoginCachePayload = {
    savedAt: Date.now(),
    host: credentials.host,
    username: credentials.username,
    port: credentials.port,
    authMethod: credentials.authMethod,
    privateKeyPath: credentials.privateKeyPath,
    keyPassphrase: credentials.keyPassphrase,
    password: credentials.password,
  };

  const nextId = makeHistoryId(nextPayload);
  const rest = readRawPayloads().filter(
    (item) => isFresh(item.savedAt) && makeHistoryId(item) !== nextId,
  );

  writePayloads([nextPayload, ...rest].slice(0, MAX_HISTORY));
}

export function removeLoginHistoryEntry(id: string): CachedLoginHistoryEntry[] {
  const remaining = readRawPayloads().filter(
    (item) => isFresh(item.savedAt) && makeHistoryId(item) !== id,
  );
  writePayloads(remaining);
  return remaining.map(payloadToHistoryEntry);
}

export function cachedFormToCredentials(form: CachedLoginForm): Ec2Credentials {
  const trimmedKeyPath = form.privateKeyPath.trim();
  const trimmedPassphrase = form.keyPassphrase.trim();
  const trimmedPassword = form.password.trim();

  return {
    host: form.host.trim(),
    username: form.username.trim(),
    port: form.port,
    authMethod: form.authMethod,
    privateKeyPath:
      form.authMethod === "pem" ? trimmedKeyPath || undefined : undefined,
    keyPassphrase:
      form.authMethod === "pem" && trimmedPassphrase
        ? trimmedPassphrase
        : undefined,
    password:
      form.authMethod === "password"
        ? trimmedPassword || undefined
        : undefined,
  };
}

export function markSkipAutoLogin(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(SKIP_AUTO_LOGIN_SESSION_KEY, "1");
}

export function consumeSkipAutoLogin(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  if (!sessionStorage.getItem(SKIP_AUTO_LOGIN_SESSION_KEY)) {
    return false;
  }
  sessionStorage.removeItem(SKIP_AUTO_LOGIN_SESSION_KEY);
  return true;
}

export function getDefaultLoginFormValues(): CachedLoginForm {
  const cached = loadLoginCache();
  if (cached) {
    return cached;
  }

  return {
    host: "",
    username: "root",
    port: 22,
    authMethod: "password",
    privateKeyPath: "",
    keyPassphrase: "",
    password: "",
  };
}
