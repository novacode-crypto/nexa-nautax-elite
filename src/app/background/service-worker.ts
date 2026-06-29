/**
 * NEXA NautaX — Service Worker (background) 
 *
 * Añadido: ACCOUNT_UPDATE handler
 * (copia este archivo sobre el existente src/app/background/service-worker.ts)
 */

import { STORAGE_KEYS } from '@/storage/namespaces';
import { cryptoService } from '@/services/crypto/CryptoService';
import { accountManager } from '@/services/accounts/AccountManager';
import { sessionManager } from '@/services/session/SessionManager';
import { getOffscreenBridge } from '@/connectors/etecsa/parsing/OffscreenBridge';
import { setIconState, notify, clearBadge } from '@/services/notification/NotificationHelper';
import type { ExtensionMessage, ExtensionResponse } from '@/modules/messaging/messages.types';
import type { NewAccountInput } from '@/services/accounts/AccountManager';

// —— Lifecycle ————————————————————————————————————————————————

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[NEXA NautaX] onInstalled', details.reason);

  const meta = await chrome.storage.local.get(STORAGE_KEYS.META);
  if (!meta[STORAGE_KEYS.META]) {
    const installationId = `inst_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    await chrome.storage.local.set({
      [STORAGE_KEYS.META]: {
        installationId,
        extensionVersion: chrome.runtime.getManifest().version,
        installedAt: Date.now(),
        schemaVersions: { accounts: 1, sessions: 1, settings: 1, scheduler: 1, logs: 1, crypto: 1 },
        lastStartup: Date.now(),
      },
    });
    console.log('[NEXA NautaX] Instalación inicial completada', installationId);
  }

  await chrome.alarms.create('nexa.heartbeat', { periodInMinutes: 1 });

  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch((err) => console.warn('[NEXA NautaX] sidePanel config failed', err));
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[NEXA NautaX] onStartup');
  chrome.alarms.create('nexa.heartbeat', { periodInMinutes: 1 });
});

// —— Alarms ————————————————————————————————————————————————

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'nexa.heartbeat') {
    console.debug('[NEXA NautaX] Heartbeat');
    return;
  }
  if (alarm.name.startsWith('nexa.scheduler.')) {
    console.log('[NEXA NautaX] Scheduler alarm', alarm.name);
    return;
  }
});

// —— Helper: auto-unlock antes de operaciones que requieren crypto ——
async function ensureUnlocked(): Promise<void> {
  const state = await cryptoService.getState();
  if (state.initialized && state.locked) {
    // Modo conveniente: intentar unlock con password vacío
    try {
      await cryptoService.unlock('');
    } catch {
      throw new Error('Crypto is locked — unlock required');
    }
  }
}

// —— Messages ————————————————————————————————————————————————

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    sendResponse({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid message' } });
    return false;
  }

  const msg = message as ExtensionMessage;
  console.log('[NEXA NautaX] Message', msg.type);

  void handleMessage(msg).then(sendResponse);
  return true;
});

async function handleMessage(msg: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    switch (msg.type) {
      // —— Crypto ——
      case 'CRYPTO_GET_STATE': {
        const state = await cryptoService.getState();
        return { ok: true, data: state };
      }

      case 'CRYPTO_CREATE_MASTER': {
        await cryptoService.createMasterPassword(msg.masterPassword);
        return { ok: true, data: null };
      }

      case 'CRYPTO_UNLOCK': {
        try {
          await cryptoService.unlock(msg.masterPassword);
          return { ok: true, data: null };
        } catch (e) {
          return {
            ok: false,
            error: {
              code: 'CRYPTO_INVALID_MASTER_PASSWORD',
              category: 'CRYPTO_ERROR',
              technicalMessage: e instanceof Error ? e.message : String(e),
              userMessage: 'Contraseña maestra incorrecta.',
              recommendedAction: 'Verifica tu contraseña maestra.',
              retryable: true,
              timestamp: Date.now(),
            },
          };
        }
      }

      case 'CRYPTO_LOCK': {
        await cryptoService.lock();
        return { ok: true, data: null };
      }

      case 'CRYPTO_CHANGE_MASTER': {
        await cryptoService.changeMasterPassword(msg.old, msg.new);
        return { ok: true, data: null };
      }

      // —— Accounts ——
      case 'ACCOUNT_LIST': {
        const accounts = await accountManager.list();
        const safe = accounts.map(({ encryptedPassword: _, ...rest }) => rest);
        return { ok: true, data: safe };
      }

      case 'ACCOUNT_CREATE': {
        try {
          await ensureUnlocked();
          const account = await accountManager.create(msg.payload as NewAccountInput);
          const { encryptedPassword: _, ...safe } = account;
          return { ok: true, data: safe };
        } catch (e) {
          return {
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              category: 'VALIDATION_ERROR',
              technicalMessage: e instanceof Error ? e.message : String(e),
              userMessage: e instanceof Error ? e.message : 'Error al crear cuenta',
              recommendedAction: '',
              retryable: false,
              timestamp: Date.now(),
            },
          };
        }
      }

      case 'ACCOUNT_UPDATE': {
        try {
          await ensureUnlocked();
          const account = await accountManager.update(msg.accountId, msg.payload as Partial<NewAccountInput>);
          const { encryptedPassword: _, ...safe } = account;
          return { ok: true, data: safe };
        } catch (e) {
          return {
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              category: 'VALIDATION_ERROR',
              technicalMessage: e instanceof Error ? e.message : String(e),
              userMessage: e instanceof Error ? e.message : 'Error al actualizar cuenta',
              recommendedAction: '',
              retryable: false,
              timestamp: Date.now(),
            },
          };
        }
      }

      case 'ACCOUNT_DELETE': {
        await ensureUnlocked();
        await accountManager.delete(msg.accountId);
        return { ok: true, data: null };
      }

      case 'ACCOUNT_SELECT': {
        await accountManager.select(msg.accountId);
        return { ok: true, data: null };
      }

      // —— Session ——
      case 'SESSION_LOGIN': {
        try {
          await ensureUnlocked();
          const session = await sessionManager.login(msg.accountId);
          await setIconState('connected');
          await clearBadge();
          return { ok: true, data: session };
        } catch (e) {
          await setIconState('error');
          await notify({ title: 'Error de conexión', message: e instanceof Error ? e.message : 'Error al conectar', priority: 'high', sound: true });
          return {
            ok: false,
            error: {
              code: 'AUTH_UNKNOWN_FAILURE',
              category: 'AUTH_ERROR',
              technicalMessage: e instanceof Error ? e.message : String(e),
              userMessage: e instanceof Error ? e.message : 'Error al conectar',
              recommendedAction: '',
              retryable: true,
              timestamp: Date.now(),
            },
          };
        }
      }

      case 'SESSION_LOGOUT': {
        await sessionManager.logout();
        await setIconState('disconnected');
        await clearBadge();
        return { ok: true, data: null };
      }

      case 'SESSION_GET_STATE': {
        const session = await sessionManager.getActiveSession();
        return { ok: true, data: session };
      }

      case 'CONNECTION_PROBE': {
        const state = await sessionManager.probeConnection();
        return { ok: true, data: { state } };
      }

      // —— Settings ——
      case 'SETTINGS_GET': {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return { ok: true, data: stored[STORAGE_KEYS.SETTINGS] ?? null };
      }

      case 'SETTINGS_UPDATE': {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const current = stored[STORAGE_KEYS.SETTINGS] ?? {};
        const updated = { ...current, ...msg.payload, updatedAt: Date.now() };
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
        return { ok: true, data: null };
      }

      case 'THEME_SET': {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const current = stored[STORAGE_KEYS.SETTINGS] ?? {};
        const updated = { ...current, theme: msg.payload, updatedAt: Date.now() };
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
        return { ok: true, data: null };
      }

      // —— Meta ——
      case 'META_GET': {
        const meta = await chrome.storage.local.get(STORAGE_KEYS.META);
        const metaObj = meta[STORAGE_KEYS.META] ?? {};
        const accounts = await accountManager.list();
        const cryptoState = await cryptoService.getState();
        // History se obtiene de otra clave si existe
        let historyCount = 0;
        try {
          const historyStorage = await chrome.storage.local.get('nexa.history.list');
          const historyList = historyStorage['nexa.history.list'];
          if (Array.isArray(historyList)) historyCount = historyList.length;
        } catch { /* ignore */ }
        return {
          ok: true,
          data: {
            installationId: metaObj.installationId ?? 'unknown',
            extensionVersion: chrome.runtime.getManifest().version,
            installedAt: metaObj.installedAt ?? 0,
            lastStartup: metaObj.lastStartup ?? 0,
            schemaVersions: metaObj.schemaVersions ?? {},
            accountsCount: accounts.length,
            historyCount,
            hasMasterPassword: cryptoState.initialized,
            cryptoCreatedAt: cryptoState.createdAt,
          },
        };
      }

      // —— Backup ——
      case 'BACKUP_EXPORT': {
        const data: Record<string, unknown> = {};
        const keys = await chrome.storage.local.get(null);
        for (const [key, value] of Object.entries(keys)) {
          if (key.startsWith('nexa.')) {
            data[key] = value;
          }
        }
        const meta = await chrome.storage.local.get(STORAGE_KEYS.META);
        const metaObj = meta[STORAGE_KEYS.META] ?? {};
        const checksum = await computeChecksum(JSON.stringify(data));
        const backup = {
          version: 1 as const,
          createdAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
          schemaVersions: metaObj.schemaVersions ?? {},
          installationId: metaObj.installationId ?? 'unknown',
          data,
          checksum,
        };
        return { ok: true, data: backup };
      }

      case 'BACKUP_IMPORT': {
        const expectedChecksum = await computeChecksum(JSON.stringify(msg.payload.data));
        if (expectedChecksum !== msg.payload.checksum) {
          return {
            ok: false,
            error: {
              code: 'BACKUP_CHECKSUM_MISMATCH',
              category: 'VALIDATION_ERROR',
              technicalMessage: 'Checksum mismatch',
              userMessage: 'El archivo de backup está corrupto o fue modificado.',
              recommendedAction: 'Verifica que el archivo no fue alterado.',
              retryable: false,
              timestamp: Date.now(),
            },
          };
        }
        const data = msg.payload.data as Record<string, unknown>;
        await chrome.storage.local.set(data);
        return { ok: true, data: null };
      }

      // —— Danger zone ——
      case 'DANGER_CLEAR_ACCOUNTS': {
        await chrome.storage.local.remove([
          STORAGE_KEYS.ACCOUNTS_LIST,
          STORAGE_KEYS.ACCOUNTS_SELECTED,
        ]);
        return { ok: true, data: null };
      }

      case 'DANGER_RESET_SETTINGS': {
        await chrome.storage.local.remove(STORAGE_KEYS.SETTINGS);
        return { ok: true, data: null };
      }

      case 'DANGER_FACTORY_RESET': {
        const all = await chrome.storage.local.get(null);
        const keysToRemove = Object.keys(all).filter((k) => k.startsWith('nexa.'));
        await chrome.storage.local.remove(keysToRemove);
        // También limpiar session storage
        try {
          await chrome.storage.session.clear();
        } catch { /* ignore */ }
        return { ok: true, data: null };
      }

      // —— UI ——
      case 'POPUP_OPENED':
      case 'SIDEPANEL_OPENED':
        return { ok: true, data: null };

      case 'OPEN_SIDEPANEL': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.sidePanel?.open({ tabId: tabs[0].id });
        }
        return { ok: true, data: null };
      }

      case 'OFFSCREEN_ENSURE': {
        await getOffscreenBridge().ensureOffscreen();
        return { ok: true, data: null };
      }

      case 'DEMO_NOTIFS': {
        // Demo: disparar badge + sonido + icono cambio
        await setIconState('error');
        await notify({ title: 'Error de conexión', message: 'No se pudo conectar con ETECSA', priority: 'high', sound: true });
        setTimeout(async () => {
          await setIconState('connected');
          await clearBadge();
          await notify({ title: 'Conexión restablecida', message: 'Conexión activa', priority: 'low', sound: true });
        }, 3000);
        return { ok: true, data: null };
      }

      case 'CLEAR_BADGE': {
        await clearBadge();
        return { ok: true, data: null };
      }

      default:
        return {
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            category: 'UNKNOWN_ERROR',
            technicalMessage: `Unhandled: ${msg.type}`,
            userMessage: 'Operación no soportada.',
            recommendedAction: '',
            retryable: false,
            timestamp: Date.now(),
          },
        };
    }
  } catch (error) {
    console.error('[NEXA NautaX] Handler error', error);
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        category: 'UNKNOWN_ERROR',
        technicalMessage: error instanceof Error ? error.message : String(error),
        userMessage: 'Error inesperado.',
        recommendedAction: 'Intenta de nuevo.',
        retryable: true,
        timestamp: Date.now(),
      },
    };
  }
}

// —— Storage change logging ———————————————————————————————————

chrome.storage.onChanged.addListener((changes, area) => {
  for (const [key] of Object.entries(changes)) {
    if (key.startsWith('nexa.')) {
      console.debug('[NEXA NautaX] Storage change', { area, key });
    }
  }
});

// —— Helpers ————————————————————————————————————————————————

async function computeChecksum(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

console.log('[NEXA NautaX] Service Worker iniciado', {
  version: chrome.runtime.getManifest().version,
  timestamp: new Date().toISOString(),
});
