/**
 * NEXA NautaX — Message types
 * Fase 2 — Doc 1 §8
 *
 * Discriminated union de todos los mensajes entre UI (popup/sidepanel) y SW.
 * TypeScript garantiza type-safety end-to-end.
 */

import type { AccountId, SchedulerTaskId } from '@/types/branded';
import type { NexaError } from '@/types/errors';
import type { ThemeSetting } from '@/types/theme';

// —— Message types (UI → SW) ————————————————————————————————————

export type ExtensionMessage =
  // —— Sesión ——
  | { readonly type: 'SESSION_LOGIN'; readonly accountId: AccountId }
  | { readonly type: 'SESSION_LOGOUT' }
  | { readonly type: 'SESSION_REFRESH' }
  | { readonly type: 'SESSION_GET_STATE' }
  // —— Cuentas ——
  | { readonly type: 'ACCOUNT_LIST' }
  | { readonly type: 'ACCOUNT_GET'; readonly accountId: AccountId }
  | { readonly type: 'ACCOUNT_CREATE'; readonly payload: NewAccountInput }
  | { readonly type: 'ACCOUNT_UPDATE'; readonly accountId: AccountId; readonly payload: AccountUpdateInput }
  | { readonly type: 'ACCOUNT_DELETE'; readonly accountId: AccountId }
  | { readonly type: 'ACCOUNT_SELECT'; readonly accountId: AccountId }
  | { readonly type: 'ACCOUNT_VERIFY_CREDENTIALS'; readonly accountId: AccountId }
  // —— Scheduler ——
  | { readonly type: 'SCHEDULER_LIST_TASKS' }
  | { readonly type: 'SCHEDULER_CREATE_TASK'; readonly payload: NewSchedulerTaskInput }
  | { readonly type: 'SCHEDULER_CANCEL_TASK'; readonly taskId: SchedulerTaskId }
  // —— Settings ——
  | { readonly type: 'SETTINGS_GET' }
  | { readonly type: 'SETTINGS_UPDATE'; readonly payload: Partial<Settings> }
  | { readonly type: 'THEME_SET'; readonly payload: ThemeSetting }
  // —— Diagnóstico ——
  | { readonly type: 'DIAGNOSTIC_GET_LOGS'; readonly filter?: LogFilter }
  | { readonly type: 'DIAGNOSTIC_CLEAR_LOGS' }
  | { readonly type: 'DIAGNOSTIC_EXPORT' }
  // —— Crypto ——
  | { readonly type: 'CRYPTO_GET_STATE' }
  | { readonly type: 'CRYPTO_UNLOCK'; readonly masterPassword: string }
  | { readonly type: 'CRYPTO_LOCK' }
  | { readonly type: 'CRYPTO_CREATE_MASTER'; readonly masterPassword: string }
  | { readonly type: 'CRYPTO_CHANGE_MASTER'; readonly old: string; readonly new: string }
  // —— Backup ——
  | { readonly type: 'BACKUP_EXPORT' }
  | { readonly type: 'BACKUP_IMPORT'; readonly payload: BackupPackage }
  // —— Connection ——
  | { readonly type: 'CONNECTION_PROBE' }
  | { readonly type: 'CONNECTION_GET_STATUS' }
  // —— Meta / Info ——
  | { readonly type: 'META_GET' }
  // —— Danger zone ——
  | { readonly type: 'DANGER_CLEAR_ACCOUNTS' }
  | { readonly type: 'DANGER_RESET_SETTINGS' }
  | { readonly type: 'DANGER_FACTORY_RESET' }
  // —— UI events ——
  | { readonly type: 'POPUP_OPENED' }
  | { readonly type: 'SIDEPANEL_OPENED' }
  | { readonly type: 'OPEN_SIDEPANEL' }
  // —— Offscreen ——
  | { readonly type: 'OFFSCREEN_ENSURE' }
  | { readonly type: 'OFFSCREEN_PARSE'; readonly payload: OffscreenRequest }
  // —— Notifications ——
  | { readonly type: 'DEMO_NOTIFS' }
  | { readonly type: 'CLEAR_BADGE' };

// —— Response ————————————————————————————————————————————————

export type ExtensionResponse<T = unknown> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: NexaError };

// —— Payload shapes ————————————————————————————————————————————

export interface NewAccountInput {
  readonly alias: string;
  readonly username: string;
  readonly password: string;
  readonly type: 'prepaid';
}

export interface AccountUpdateInput {
  readonly alias?: string;
  readonly username?: string;
  readonly password?: string;
  readonly type?: 'prepaid';
}

export interface NewSchedulerTaskInput {
  readonly type: 'LOGOUT_TIMER' | 'LOGOUT_TIME' | 'MAX_SESSION_TIME';
  readonly trigger: SchedulerTrigger;
  readonly enabled: boolean;
  readonly recurring: boolean;
}

export type SchedulerTrigger =
  | { readonly kind: 'delay'; readonly minutes: number }
  | { readonly kind: 'atTime'; readonly hour: number; readonly minute: number; readonly daysOfWeek?: number[] }
  | { readonly kind: 'maxSession'; readonly hours: number };

export interface Settings {
  readonly theme: ThemeSetting;
  readonly behavior: {
    readonly restoreSessionOnStartup: boolean;
    readonly startWithBrowser: boolean;
    readonly onPopupClose: 'keep_session' | 'logout';
  };
  readonly notifications: {
    readonly enabled: boolean;
    readonly soundAlerts: boolean;
    readonly onDisconnect: boolean;
    readonly onLowBalance: boolean;
    readonly lowBalanceThreshold: number;
    readonly onLowTime: boolean;
    readonly lowTimeThresholdMinutes: number;
    readonly onConnectorError: boolean;
    readonly verbosity: 'minimal' | 'normal' | 'detailed';
  };
  readonly security: {
    readonly autoLockMinutes: number;
    readonly requireUnlockOnOpen: boolean;
  };
  readonly developer: {
    readonly visible: boolean;
    readonly logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    readonly verboseNetwork: boolean;
    readonly traceStrategies: boolean;
    readonly demoMode: boolean;
  };
  readonly schemaVersion: number;
  readonly updatedAt: number;
}

export interface LogFilter {
  readonly level?: string | string[];
  readonly category?: string | string[];
  readonly since?: number;
  readonly until?: number;
  readonly search?: string;
  readonly limit?: number;
}

export interface BackupPackage {
  readonly version: 1;
  readonly createdAt: number;
  readonly extensionVersion: string;
  readonly schemaVersions: Record<string, number>;
  readonly installationId: string;
  readonly data: unknown;
  readonly checksum: string;
}

export interface ExtensionMeta {
  readonly installationId: string;
  readonly extensionVersion: string;
  readonly installedAt: number;
  readonly lastStartup: number;
  readonly schemaVersions: Record<string, number>;
  readonly accountsCount: number;
  readonly historyCount: number;
  readonly hasMasterPassword: boolean;
  readonly cryptoCreatedAt: number | null;
}

export type OffscreenRequest =
  | { readonly type: 'PARSE_LOGIN_FORM'; readonly html: string }
  | { readonly type: 'EXTRACT_ATTRIBUTE_UUID'; readonly html: string }
  | { readonly type: 'EXTRACT_ALERT_MESSAGE'; readonly html: string }
  | { readonly type: 'EXTRACT_SESSION_INFO'; readonly html: string };
