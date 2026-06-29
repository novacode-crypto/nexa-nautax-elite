/**
 * NEXA NautaX — Storage namespaces
 *  — Doc 3 §1.2
 */

export const NAMESPACES = {
  accounts: 'nexa.accounts',
  sessions: 'nexa.sessions',
  history: 'nexa.history',
  settings: 'nexa.settings',
  scheduler: 'nexa.scheduler',
  logs: 'nexa.logs',
  notifications: 'nexa.notifications',
  crypto: 'nexa.crypto',
  meta: 'nexa.meta',
  preferences: 'nexa.preferences',
} as const;

export type Namespace = keyof typeof NAMESPACES;

// Keys específicas
export const STORAGE_KEYS = {
  // Accounts
  ACCOUNTS_LIST: `${NAMESPACES.accounts}.list`,
  ACCOUNTS_SELECTED: `${NAMESPACES.accounts}.selected`,
  ACCOUNTS_META: `${NAMESPACES.accounts}.meta`,
  // Sessions
  SESSION_ACTIVE: `${NAMESPACES.sessions}.active`,
  SESSION_CONNECTION: `${NAMESPACES.sessions}.connection`,
  SESSION_LAST_ERROR: `${NAMESPACES.sessions}.lastError`,
  // Settings
  SETTINGS: NAMESPACES.settings,
  // Crypto
  CRYPTO_VERIFIER: `${NAMESPACES.crypto}.verifier`,
  CRYPTO_META: `${NAMESPACES.crypto}.meta`,
  CRYPTO_AES_KEY: `${NAMESPACES.crypto}.aesKey`, // en storage.session
  CRYPTO_DERIVED_AT: `${NAMESPACES.crypto}.derivedAt`, // en storage.session
  // Meta
  META: NAMESPACES.meta,
  // Notifications
  NOTIFICATIONS_ACTIVE: `${NAMESPACES.notifications}.active`,
} as const;
