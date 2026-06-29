/**
 * NEXA NautaX — Chrome Storage Driver
 * Fase 4 — Doc 3 §3
 *
 * Wrapper tipado sobre chrome.storage.local y chrome.storage.session.
 * Maneja eventos onChanged.
 */

export interface IChromeStorageDriver {
  // —— chrome.storage.local ——————————————————————————
  getLocal<T>(key: string): Promise<T | null>;
  setLocal<T>(key: string, value: T): Promise<void>;
  removeLocal(key: string): Promise<void>;
  clearLocal(prefix?: string): Promise<void>;
  getLocalByPrefix<T>(prefix: string): Promise<Readonly<Record<string, T>>>;

  // —— chrome.storage.session —————————————————————————
  getSession<T>(key: string): Promise<T | null>;
  setSession<T>(key: string, value: T): Promise<void>;
  removeSession(key: string): Promise<void>;
  clearSession(): Promise<void>;

  // —— Events ——————————————————————————————————————————
  onLocalChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void;
  onSessionChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void;
}

class ChromeStorageDriverImpl implements IChromeStorageDriver {
  async getLocal<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? null;
  }

  async setLocal<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async removeLocal(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clearLocal(prefix?: string): Promise<void> {
    if (!prefix) {
      await chrome.storage.local.clear();
      return;
    }
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter((k) => k.startsWith(prefix));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  }

  async getLocalByPrefix<T>(prefix: string): Promise<Record<string, T>> {
    const all = await chrome.storage.local.get(null);
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(prefix)) {
        result[key] = value as T;
      }
    }
    return result;
  }

  async getSession<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.session.get(key);
    return (result[key] as T | undefined) ?? null;
  }

  async setSession<T>(key: string, value: T): Promise<void> {
    await chrome.storage.session.set({ [key]: value });
  }

  async removeSession(key: string): Promise<void> {
    await chrome.storage.session.remove(key);
  }

  async clearSession(): Promise<void> {
    await chrome.storage.session.clear();
  }

  onLocalChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return;
      if (!(key in changes)) return;
      const change = changes[key];
      if (!change) return;
      handler(change.newValue, change.oldValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  onSessionChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'session') return;
      if (!(key in changes)) return;
      const change = changes[key];
      if (!change) return;
      handler(change.newValue, change.oldValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
}

// Singleton
let driverInstance: IChromeStorageDriver | null = null;

export function getStorageDriver(): IChromeStorageDriver {
  if (!driverInstance) {
    driverInstance = new ChromeStorageDriverImpl();
  }
  return driverInstance;
}
