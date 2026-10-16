import { LazyStore } from "@tauri-apps/plugin-store";

const STORE_FILE = "ai-chat.json";
const ACTIVE_CONVERSATION_KEY = "activeConversationId";
const BROWSER_FALLBACK_KEY = "ec2-gui-ai-active-conversation";

let store: LazyStore | null = null;

function getStore(): LazyStore {
  store ??= new LazyStore(STORE_FILE, { autoSave: true, defaults: {} });
  return store;
}

export async function loadActiveConversationId(): Promise<string | null> {
  try {
    const value = await getStore().get<unknown>(ACTIVE_CONVERSATION_KEY);
    if (typeof value === "string" && value) return value;
    if (value === null) return null;
  } catch {
    // 브라우저(vite only)에서는 store 플러그인이 없을 수 있음
  }
  try {
    return localStorage.getItem(BROWSER_FALLBACK_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveConversationId(id: string | null): Promise<void> {
  try {
    if (id) localStorage.setItem(BROWSER_FALLBACK_KEY, id);
    else localStorage.removeItem(BROWSER_FALLBACK_KEY);
  } catch {
    // ignore quota / private mode
  }
  try {
    await getStore().set(ACTIVE_CONVERSATION_KEY, id);
  } catch {
    // 브라우저(vite only)에서는 store 플러그인이 없을 수 있음
  }
}
