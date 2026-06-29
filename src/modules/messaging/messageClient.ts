/**
 * NEXA NautaX — Message Client 
 *
 * Añadido: accountUpdate
 */

import type { ExtensionMessage, ExtensionResponse, BackupPackage, ExtensionMeta, Settings } from './messages.types';

export type { ExtensionMeta, BackupPackage, Settings };

export async function sendMessage<T = unknown>(
  message: ExtensionMessage,
): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            category: 'UNKNOWN_ERROR',
            technicalMessage: chrome.runtime.lastError?.message ?? 'Unknown error',
            userMessage: 'Error de comunicación con el Service Worker.',
            recommendedAction: '',
            retryable: true,
            timestamp: Date.now(),
          },
        });
      } else {
        resolve(response);
      }
    });
  });
}

export const messageClient = {
  // Crypto
  cryptoGetState: () => sendMessage<{ initialized: boolean; locked: boolean; createdAt: number | null }>({ type: 'CRYPTO_GET_STATE' }),
  cryptoCreateMaster: (masterPassword: string) => sendMessage({ type: 'CRYPTO_CREATE_MASTER', masterPassword }),
  cryptoUnlock: (masterPassword: string) => sendMessage({ type: 'CRYPTO_UNLOCK', masterPassword }),
  cryptoLock: () => sendMessage({ type: 'CRYPTO_LOCK' }),

  // Accounts
  accountList: () => sendMessage<readonly AccountSummary[]>({ type: 'ACCOUNT_LIST' }),
  accountCreate: (payload: NewAccountPayload) => sendMessage<AccountSummary>({ type: 'ACCOUNT_CREATE', payload }),
  accountUpdate: (accountId: string, payload: UpdateAccountPayload) => sendMessage<AccountSummary>({ type: 'ACCOUNT_UPDATE', accountId: accountId as never, payload }),
  accountDelete: (accountId: string) => sendMessage({ type: 'ACCOUNT_DELETE', accountId: accountId as never }),
  accountSelect: (accountId: string) => sendMessage({ type: 'ACCOUNT_SELECT', accountId: accountId as never }),

  // Session
  sessionLogin: (accountId: string) => sendMessage<SessionSummary>({ type: 'SESSION_LOGIN', accountId: accountId as never }),
  sessionLogout: () => sendMessage({ type: 'SESSION_LOGOUT' }),
  sessionGetState: () => sendMessage<SessionSummary | null>({ type: 'SESSION_GET_STATE' }),

  // Connection
  connectionProbe: () => sendMessage<{ state: string }>({ type: 'CONNECTION_PROBE' }),

  // Settings
  settingsGet: () => sendMessage({ type: 'SETTINGS_GET' }),
  settingsUpdate: (payload: Partial<Settings>) => sendMessage({ type: 'SETTINGS_UPDATE', payload }),
  themeSet: (payload: { mode: 'manual' | 'system'; theme: string }) => sendMessage({ type: 'THEME_SET', payload: payload as never }),

  // Meta
  metaGet: () => sendMessage<ExtensionMeta>({ type: 'META_GET' }),

  // Backup
  backupExport: () => sendMessage<BackupPackage>({ type: 'BACKUP_EXPORT' }),
  backupImport: (payload: BackupPackage) => sendMessage({ type: 'BACKUP_IMPORT', payload }),

  // Danger zone
  dangerClearAccounts: () => sendMessage({ type: 'DANGER_CLEAR_ACCOUNTS' }),
  dangerResetSettings: () => sendMessage({ type: 'DANGER_RESET_SETTINGS' }),
  dangerFactoryReset: () => sendMessage({ type: 'DANGER_FACTORY_RESET' }),

  // UI
  openSidePanel: () => sendMessage({ type: 'OPEN_SIDEPANEL' }),

  // Notifications
  demoNotifs: () => sendMessage({ type: 'DEMO_NOTIFS' as never }),
  clearBadge: () => sendMessage({ type: 'CLEAR_BADGE' as never }),
};

export interface AccountSummary {
  readonly id: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: 'nauta.com.cu' | 'nauta.co.cu';
  readonly type: 'prepaid';
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastUsed: number | null;
  readonly avatar?: string | undefined;
}

export interface NewAccountPayload {
  readonly alias: string;
  readonly username: string;
  readonly domain: 'nauta.com.cu' | 'nauta.co.cu';
  readonly password: string;
  readonly type: 'prepaid';
  readonly avatar?: string;
}

export interface UpdateAccountPayload {
  readonly alias?: string;
  readonly username?: string;
  readonly domain?: 'nauta.com.cu' | 'nauta.co.cu';
  readonly password?: string;
  readonly avatar?: string;
  readonly type?: 'prepaid';
}

export interface SessionSummary {
  readonly accountId: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: string;
  readonly avatar?: string | undefined;
  readonly startedAt: number;
  readonly totalSeconds?: number | null;
}
