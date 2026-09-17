import type { SshAuthMethod, SshCredentials } from "@/types/connection";

/** 이전 접속 기록 (연결 해제 후에도 유지) */
const HISTORY_STORAGE_KEY = "ec2-gui-login-history";
/** 앱 시작 시 자동 접속용 (연결 해제 시 삭제) */
const AUTO_LOGIN_STORAGE_KEY = "ec2-gui-auto-login";
/** 레거시 단일 키 — 마이그레이션 후 제거 */
const LEGACY_STORAGE_KEY = "ec2-gui-login-cache";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY = 8;

export interface CachedLoginForm {
  host: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
  privateKeyPath: string;
  keyPassphrase: string;
  password: string;
  /** 이전 접속 목록에 타이틀로 표시되는 메모 */
  memo: string;
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
  authMethod: SshAuthMethod;
  privateKeyPath?: string;
  keyPassphrase?: string;
  password?: string;
  memo?: string;
}

/** 연결 해제 후 자동 로그인을 막을 때 사용. 다음 수동/성공 로그인까지 유지 */
let skipAutoLogin = false;

function isAuthMethod(value: unknown): value is SshAuthMethod {
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

  const memo =
    typeof parsed.memo === "string" ? parsed.memo.trim() : undefined;

  return {
    savedAt: parsed.savedAt,
    host: parsed.host,
    username: parsed.username,
    port: parsed.port,
    authMethod: parsed.authMethod,
    privateKeyPath: parsed.privateKeyPath,
    keyPassphrase: parsed.keyPassphrase,
    password: parsed.password,
    memo: memo || undefined,
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
    memo: payload.memo ?? "",
  };
}

function normalizeMemo(memo: string | undefined): string | undefined {
  const trimmed = memo?.trim();
  return trimmed ? trimmed : undefined;
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

function readJson(key: string): unknown {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(key);
}

function readPayloadList(key: string): LoginCachePayload[] {
  const parsed = readJson(key);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => parseCachePayload(item))
      .filter((item): item is LoginCachePayload => item !== null);
  }
  const single = parseCachePayload(parsed);
  return single ? [single] : [];
}

function writeHistoryPayloads(payloads: LoginCachePayload[]): void {
  if (payloads.length === 0) {
    removeKey(HISTORY_STORAGE_KEY);
    return;
  }
  writeJson(HISTORY_STORAGE_KEY, payloads);
}

function migrateLegacyCacheIfNeeded(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) {
    return;
  }

  const legacyItems = readPayloadList(LEGACY_STORAGE_KEY);
  const existingHistory = readPayloadList(HISTORY_STORAGE_KEY);
  const existingAuto = parseCachePayload(readJson(AUTO_LOGIN_STORAGE_KEY));

  if (legacyItems.length > 0) {
    if (existingHistory.length === 0) {
      writeHistoryPayloads(
        legacyItems.filter((item) => isFresh(item.savedAt)).slice(0, MAX_HISTORY),
      );
    }
    if (!existingAuto && legacyItems[0] && isFresh(legacyItems[0].savedAt)) {
      writeJson(AUTO_LOGIN_STORAGE_KEY, legacyItems[0]);
    }
  }

  removeKey(LEGACY_STORAGE_KEY);
}

export function loadLoginHistory(): CachedLoginHistoryEntry[] {
  migrateLegacyCacheIfNeeded();
  const fresh = readPayloadList(HISTORY_STORAGE_KEY).filter((item) =>
    isFresh(item.savedAt),
  );
  writeHistoryPayloads(fresh);
  return fresh.map(payloadToHistoryEntry);
}

/** 자동 접속용 캐시 (연결 해제 시 비움) */
export function loadAutoLoginCache(): CachedLoginForm | null {
  migrateLegacyCacheIfNeeded();
  const payload = parseCachePayload(readJson(AUTO_LOGIN_STORAGE_KEY));
  if (!payload || !isFresh(payload.savedAt)) {
    clearAutoLoginCache();
    return null;
  }
  return payloadToForm(payload);
}

/** @deprecated loadAutoLoginCache 사용. 폼 기본값은 getDefaultLoginFormValues */
export function loadLoginCache(): CachedLoginForm | null {
  return loadAutoLoginCache();
}

function credentialsToPayload(
  credentials: SshCredentials,
  memo?: string,
): LoginCachePayload {
  return {
    savedAt: Date.now(),
    host: credentials.host,
    username: credentials.username,
    port: credentials.port,
    authMethod: credentials.authMethod,
    privateKeyPath: credentials.privateKeyPath,
    keyPassphrase: credentials.keyPassphrase,
    password: credentials.password,
    memo: normalizeMemo(memo),
  };
}

export function saveLoginHistory(
  credentials: SshCredentials,
  memo?: string,
): void {
  migrateLegacyCacheIfNeeded();
  const nextId = makeHistoryId(credentials);
  const existing = readPayloadList(HISTORY_STORAGE_KEY).find(
    (item) => makeHistoryId(item) === nextId,
  );
  const nextPayload = credentialsToPayload(
    credentials,
    memo !== undefined ? memo : existing?.memo,
  );
  const rest = readPayloadList(HISTORY_STORAGE_KEY).filter(
    (item) => isFresh(item.savedAt) && makeHistoryId(item) !== nextId,
  );
  writeHistoryPayloads([nextPayload, ...rest].slice(0, MAX_HISTORY));
}

export function saveAutoLoginCache(credentials: SshCredentials): void {
  writeJson(AUTO_LOGIN_STORAGE_KEY, credentialsToPayload(credentials));
}

/** 접속 성공 시: 기록 유지 + 자동 접속 캐시 갱신 */
export function saveLoginCache(
  credentials: SshCredentials,
  memo?: string,
): void {
  saveLoginHistory(credentials, memo);
  saveAutoLoginCache(credentials);
  clearSkipAutoLogin();
}

/** 이전 접속 기록의 메모만 갱신 */
export function updateLoginHistoryMemo(
  id: string,
  memo: string,
): CachedLoginHistoryEntry[] {
  migrateLegacyCacheIfNeeded();
  const normalized = normalizeMemo(memo);
  const next = readPayloadList(HISTORY_STORAGE_KEY)
    .filter((item) => isFresh(item.savedAt))
    .map((item) =>
      makeHistoryId(item) === id ? { ...item, memo: normalized } : item,
    );
  writeHistoryPayloads(next);
  return next.map(payloadToHistoryEntry);
}

export function clearAutoLoginCache(): void {
  removeKey(AUTO_LOGIN_STORAGE_KEY);
}

export function removeLoginHistoryEntry(id: string): CachedLoginHistoryEntry[] {
  migrateLegacyCacheIfNeeded();
  const remaining = readPayloadList(HISTORY_STORAGE_KEY).filter(
    (item) => isFresh(item.savedAt) && makeHistoryId(item) !== id,
  );
  writeHistoryPayloads(remaining);
  return remaining.map(payloadToHistoryEntry);
}

export function cachedFormToCredentials(form: CachedLoginForm): SshCredentials {
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

/** 연결 해제 시: 자동 접속만 끄고, 접속 기록은 유지 */
export function markSkipAutoLogin(): void {
  skipAutoLogin = true;
  clearAutoLoginCache();
}

export function shouldSkipAutoLogin(): boolean {
  return skipAutoLogin;
}

export function clearSkipAutoLogin(): void {
  skipAutoLogin = false;
}

/** @deprecated shouldSkipAutoLogin 사용 */
export function consumeSkipAutoLogin(): boolean {
  if (!skipAutoLogin) {
    return false;
  }
  return true;
}

export function getDefaultLoginFormValues(): CachedLoginForm {
  const history = loadLoginHistory();
  if (history[0]) {
    const { id: _id, savedAt: _savedAt, ...form } = history[0];
    return form;
  }

  return {
    host: "",
    username: "root",
    port: 22,
    authMethod: "password",
    privateKeyPath: "",
    keyPassphrase: "",
    password: "",
    memo: "",
  };
}
