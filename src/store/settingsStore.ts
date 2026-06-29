/**
 * NEXA NautaX — Settings Store
 *  — Doc 1 §7.2
 *
 * Configuración global persistida en chrome.storage.local.
 * Se hidrata desde storage al montar y se sincroniza via onChanged.
 */

import { create } from 'zustand';
import type { ThemeName, ThemeSetting } from '@/types/theme';
import { STORAGE_KEYS } from '@/storage/namespaces';
import { getStorageDriver } from '@/storage/driver/chromeStorageDriver';
import type { Settings } from '@/modules/messaging/messages.types';

// —— Defaults ————————————————————————————————————————————

export const DEFAULT_SETTINGS: Settings = {
  theme: { mode: 'manual', theme: 'oscuro' },
  behavior: {
    restoreSessionOnStartup: false,
    startWithBrowser: false,
    onPopupClose: 'keep_session',
  },
  notifications: {
    enabled: true,
    soundAlerts: true,
    onDisconnect: true,
    onLowBalance: true,
    lowBalanceThreshold: 5.0,
    onLowTime: false,
    lowTimeThresholdMinutes: 10,
    onConnectorError: true,
    verbosity: 'normal',
  },
  security: {
    autoLockMinutes: 0,
    requireUnlockOnOpen: true,
  },
  developer: {
    visible: false,
    logLevel: 'INFO',
    verboseNetwork: false,
    traceStrategies: false,
    demoMode: false,
  },
  schemaVersion: 1,
  updatedAt: Date.now(),
};

// —— Store ————————————————————————————————————————————————————

interface SettingsState {
  readonly settings: Settings;
  readonly hydrated: boolean;
}

interface SettingsActions {
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeName) => Promise<void>;
  setSystemTheme: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
  setDeveloperVisible: (visible: boolean) => Promise<void>;
  setDemoMode: (demoMode: boolean) => Promise<void>;
  updateNotifications: (partial: Partial<Settings['notifications']>) => Promise<void>;
  updateBehavior: (partial: Partial<Settings['behavior']>) => Promise<void>;
  updateSecurity: (partial: Partial<Settings['security']>) => Promise<void>;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const driver = getStorageDriver();
    const stored = await driver.getLocal<Settings>(STORAGE_KEYS.SETTINGS);
    if (stored) {
      // Merge con defaults para asegurar que campos nuevos existan
      const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        theme: { ...DEFAULT_SETTINGS.theme, ...stored.theme },
        behavior: { ...DEFAULT_SETTINGS.behavior, ...stored.behavior },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
        security: { ...DEFAULT_SETTINGS.security, ...stored.security },
        developer: { ...DEFAULT_SETTINGS.developer, ...stored.developer },
      };
      set({ settings: merged, hydrated: true });
    } else {
      // Primera vez: guardar defaults
      await driver.setLocal(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      set({ settings: DEFAULT_SETTINGS, hydrated: true });
    }

    // Suscribirse a cambios externos (escritos por el SW u otra surface)
    driver.onLocalChanged(STORAGE_KEYS.SETTINGS, (newValue) => {
      if (newValue && typeof newValue === 'object') {
        const newSettings = newValue as Settings;
        set({ settings: { ...DEFAULT_SETTINGS, ...newSettings } });
      }
    });
  },

  setTheme: async (theme) => {
    const current = get().settings;
    const newSetting: ThemeSetting = { mode: 'manual', theme };
    const updated: Settings = {
      ...current,
      theme: newSetting,
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  setSystemTheme: async () => {
    const current = get().settings;
    const newSetting: ThemeSetting = { mode: 'system', theme: current.theme.theme };
    const updated: Settings = {
      ...current,
      theme: newSetting,
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  update: async (partial) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  setDeveloperVisible: async (visible) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      developer: { ...current.developer, visible },
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  setDemoMode: async (demoMode) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      developer: { ...current.developer, demoMode },
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  updateNotifications: async (partial) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      notifications: { ...current.notifications, ...partial },
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  updateBehavior: async (partial) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      behavior: { ...current.behavior, ...partial },
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },

  updateSecurity: async (partial) => {
    const current = get().settings;
    const updated: Settings = {
      ...current,
      security: { ...current.security, ...partial },
      updatedAt: Date.now(),
    };
    set({ settings: updated });
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SETTINGS, updated);
  },
}));
