# NEXA NautaX — Storage Architecture

**Fase:** 4
**Documento:** 3 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Arquitectura completa de persistencia: namespaces, repositories, migrations, backup. Basado en `chrome.storage.local` (persistente) y `chrome.storage.session` (volátil).

---

## 1. Visión General

### 1.1 Dos áreas de almacenamiento

| Área | Persistencia | Uso | Límite aprox. |
|------|--------------|-----|---------------|
| `chrome.storage.local` | Permanente (hasta uninstall) | Datos de usuario: cuentas, settings, historial, logs | 10 MB (soft) |
| `chrome.storage.session` | Volátil (se borra al cerrar browser) | Llave AES derivada, estado efímero | 10 MB |

> **NO usamos `chrome.storage.sync`** — sube datos a la nube Google, lo cual viola el principio de privacidad NEXA y expone credenciales cifradas a Google.

### 1.2 Estructura de namespaces

```
nexa.
  ├── accounts.*          # Cuentas guardadas
  ├── accounts.selected   # AccountId seleccionado
  ├── accounts.meta       # { schemaVersion, lastModified }
  │
  ├── sessions.active     # SessionData | null
  ├── sessions.connection # ConnectionSnapshot
  ├── sessions.lastError  # NexaError | null
  │
  ├── history.{id}        # SessionRecord por id
  ├── history.index       # Array de ids ordenados por startedAt
  │
  ├── settings            # Settings object
  │
  ├── scheduler.{id}      # SchedulerTask por id
  ├── scheduler.index     # Array de ids
  │
  ├── logs.entries        # Array<DiagnosticLog> (FIFO, max 5000)
  ├── logs.network        # Array<NetworkRecord> (FIFO, max 1000)
  ├── logs.connectorHealth # ConnectorHealth (in-memory mirror, persisted occasionally)
  │
  ├── notifications.active # Array<Notification> (max 20)
  │
  ├── crypto.verifier     # CryptoVerifier (salt, verifier, kdfParams)
  ├── crypto.meta         # { schemaVersion }
  │
  ├── meta                # Meta (installationId, extensionVersion, etc.)
  │
  └── preferences         # Generic key-value for future use
```

En `chrome.storage.session`:

```
nexa.
  └── crypto.aesKey       # base64(32 bytes raw)
  └── crypto.derivedAt    # timestamp
```

---

## 2. Repositories

### 2.1 Patrón

Cada repository encapsula un namespace. Expone CRUD tipado. Valida con Zod antes de escribir.

```typescript
interface IRepository<T, ID = string> {
  get(id: ID): Promise<T | null>;
  list(): Promise<readonly T[]>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
  clear(): Promise<void>;
}
```

### 2.2 AccountRepository

```typescript
interface IAccountRepository extends IRepository<Account, AccountId> {
  getSelected(): Promise<Account | null>;
  setSelected(accountId: AccountId): Promise<void>;
  clearSelected(): Promise<void>;
  getByUsername(username: string): Promise<Account | null>;
  markUsed(accountId: AccountId, at: number): Promise<void>;
}
```

**Implementación conceptual**:

```typescript
class AccountRepository implements IAccountRepository {
  private static PREFIX = 'nexa.accounts';
  private static SELECTED_KEY = 'nexa.accounts.selected';
  private static META_KEY = 'nexa.accounts.meta';
  
  async get(id: AccountId): Promise<Account | null> {
    const raw = await chrome.storage.local.get(`${AccountRepository.PREFIX}.${id}`);
    if (!raw) return null;
    const parsed = accountSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }
  
  async list(): Promise<readonly Account[]> {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([key]) => key.startsWith(AccountRepository.PREFIX + '.'))
      .filter(([key]) => key !== AccountRepository.SELECTED_KEY && key !== AccountRepository.META_KEY)
      .map(([, value]) => accountSchema.safeParse(value))
      .filter((r): r is z.SafeParseSuccess<Account> => r.success)
      .map(r => r.data);
  }
  
  async save(account: Account): Promise<void> {
    // Validate
    accountSchema.parse(account);
    await chrome.storage.local.set({
      [`${AccountRepository.PREFIX}.${account.id}`]: account,
    });
    await this.touchMeta();
  }
  
  async delete(id: AccountId): Promise<void> {
    await chrome.storage.local.remove(`${AccountRepository.PREFIX}.${id}`);
    // Si era la seleccionada, limpiar selección
    const selected = await this.getSelected();
    if (selected?.id === id) {
      await this.clearSelected();
    }
    await this.touchMeta();
  }
  
  async getSelected(): Promise<Account | null> {
    const { [AccountRepository.SELECTED_KEY]: selectedId } = 
      await chrome.storage.local.get(AccountRepository.SELECTED_KEY);
    if (!selectedId) return null;
    return this.get(selectedId as AccountId);
  }
  
  async setSelected(accountId: AccountId): Promise<void> {
    // Primero deseleccionar todas (D02: una sola activa)
    const accounts = await this.list();
    for (const acc of accounts) {
      if (acc.isSelected && acc.id !== accountId) {
        await this.save({ ...acc, isSelected: false });
      }
    }
    // Seleccionar la nueva
    const target = await this.get(accountId);
    if (!target) throw new Error('Account not found');
    await this.save({ ...target, isSelected: true });
    await chrome.storage.local.set({ [AccountRepository.SELECTED_KEY]: accountId });
  }
  
  // ... otros métodos
  
  private async touchMeta(): Promise<void> {
    const meta = {
      schemaVersion: 1,
      lastModified: Date.now(),
    };
    await chrome.storage.local.set({ [AccountRepository.META_KEY]: meta });
  }
}
```

### 2.3 SessionRepository

```typescript
interface ISessionRepository {
  getActive(): Promise<SessionData | null>;
  setActive(session: SessionData): Promise<void>;
  updateActive(session: SessionData): Promise<void>;
  clearActive(): Promise<void>;
  
  getConnectionState(): Promise<ConnectionSnapshot | null>;
  setConnectionState(state: ConnectionSnapshot): Promise<void>;
  
  getLastError(): Promise<NexaError | null>;
  setLastError(error: NexaError | null): Promise<void>;
}
```

**Keys**:
- `nexa.sessions.active` → `SessionData | null`
- `nexa.sessions.connection` → `ConnectionSnapshot`
- `nexa.sessions.lastError` → `NexaError | null`

### 2.4 HistoryRepository

```typescript
interface IHistoryRepository {
  startRecord(session: SessionData): Promise<SessionRecord>;
  endRecord(sessionId: SessionId, reason: SessionEndReason): Promise<void>;
  list(limit?: number, accountId?: AccountId): Promise<readonly SessionRecord[]>;
  getByAccount(accountId: AccountId): Promise<readonly SessionRecord[]>;
  anonymizeByAccount(accountId: AccountId): Promise<void>;  // mantiene registro pero sin accountId
  clear(): Promise<void>;
  clearBefore(timestamp: number): Promise<void>;
}
```

**Estructura**:
- `nexa.history.{sessionId}` → `SessionRecord`
- `nexa.history.index` → `SessionId[]` (ordenado por `startedAt` desc)

**Política**:
- Máximo 1000 registros.
- FIFO: al agregar uno nuevo, si hay 1000, eliminar el más antiguo.

### 2.5 SettingsRepository

```typescript
interface ISettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  update(partial: Partial<Settings>): Promise<Settings>;
  reset(): Promise<void>;
}
```

**Key**: `nexa.settings`

**Default**: si no existe, retorna `DEFAULT_SETTINGS` (definido en Doc 1 §6.2).

### 2.6 SchedulerRepository

```typescript
interface ISchedulerRepository {
  get(taskId: SchedulerTaskId): Promise<SchedulerTask | null>;
  list(): Promise<readonly SchedulerTask[]>;
  listActive(): Promise<readonly SchedulerTask[]>;
  listByAccount(accountId: AccountId): Promise<readonly SchedulerTask[]>;
  save(task: SchedulerTask): Promise<void>;
  delete(taskId: SchedulerTaskId): Promise<void>;
  deleteByAccount(accountId: AccountId): Promise<void>;
  clear(): Promise<void>;
}
```

**Keys**:
- `nexa.scheduler.{taskId}` → `SchedulerTask`
- `nexa.scheduler.index` → `SchedulerTaskId[]`

### 2.7 LogRepository

```typescript
interface ILogRepository {
  add(entry: DiagnosticLog): Promise<void>;
  list(filter?: LogFilter): Promise<readonly DiagnosticLog[]>;
  clear(): Promise<void>;
  clearBefore(timestamp: number): Promise<void>;
  count(): Promise<number>;
}

interface INetworkRepository {
  add(record: NetworkRecord): Promise<void>;
  list(limit?: number): Promise<readonly NetworkRecord[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
```

**Keys**:
- `nexa.logs.entries` → `DiagnosticLog[]` (FIFO max 5000)
- `nexa.logs.network` → `NetworkRecord[]` (FIFO max 1000)
- `nexa.logs.connectorHealth` → `ConnectorHealth`

**Operación atómica para FIFO**:

```typescript
async add(entry: DiagnosticLog): Promise<void> {
  const { [LogRepository.KEY]: entries = [] } = 
    await chrome.storage.local.get(LogRepository.KEY);
  
  const updated = [...entries, entry];
  if (updated.length > 5000) {
    updated.splice(0, updated.length - 5000);  // remove oldest
  }
  
  await chrome.storage.local.set({ [LogRepository.KEY]: updated });
}
```

### 2.8 NotificationRepository

```typescript
interface INotificationRepository {
  add(notification: Notification): Promise<void>;
  list(): Promise<readonly Notification[]>;
  listActive(): Promise<readonly Notification[]>;
  markDismissed(notificationId: NotificationId): Promise<void>;
  clearDismissed(): Promise<void>;
  clear(): Promise<void>;
}
```

**Key**: `nexa.notifications.active` → `Notification[]` (max 20)

### 2.9 CryptoRepository

```typescript
interface ICryptoRepository {
  getVerifier(): Promise<CryptoVerifier | null>;
  setVerifier(verifier: CryptoVerifier): Promise<void>;
  clearVerifier(): Promise<void>;
  
  // Session storage (volatile)
  getActiveKey(): Promise<string | null>;  // base64
  setActiveKey(keyBase64: string): Promise<void>;
  clearActiveKey(): Promise<void>;
}
```

**Keys**:
- `chrome.storage.local`:
  - `nexa.crypto.verifier` → `CryptoVerifier`
  - `nexa.crypto.meta` → `{ schemaVersion: 1 }`
- `chrome.storage.session`:
  - `nexa.crypto.aesKey` → `string` (base64)
  - `nexa.crypto.derivedAt` → `number`

### 2.10 MetaRepository

```typescript
interface IMetaRepository {
  get(): Promise<Meta | null>;
  set(meta: Meta): Promise<void>;
  update(partial: Partial<Meta>): Promise<Meta>;
  
  getInstallationId(): Promise<InstallationId>;
  getSchemaVersion(namespace: string): Promise<number>;
  setSchemaVersion(namespace: string, version: number): Promise<void>;
  getAllSchemaVersions(): Promise<Readonly<Record<string, number>>>;
}
```

**Key**: `nexa.meta`

---

## 3. Storage Driver

### 3.1 Wrapper tipado

```typescript
// src/storage/driver/chromeStorageDriver.ts

interface IChromeStorageDriver {
  // chrome.storage.local
  getLocal<T>(key: string): Promise<T | null>;
  setLocal<T>(key: string, value: T): Promise<void>;
  removeLocal(key: string): Promise<void>;
  clearLocal(prefix?: string): Promise<void>;
  getLocalByPrefix<T>(prefix: string): Promise<Readonly<Record<string, T>>>;
  
  // chrome.storage.session
  getSession<T>(key: string): Promise<T | null>;
  setSession<T>(key: string, value: T): Promise<void>;
  removeSession(key: string): Promise<void>;
  clearSession(): Promise<void>;
  
  // Events
  onLocalChanged(
    key: string,
    handler: (newValue: unknown, oldValue: unknown) => void
  ): () => void;  // unsubscribe
  
  onSessionChanged(
    key: string,
    handler: (newValue: unknown, oldValue: unknown) => void
  ): () => void;
}
```

### 3.2 Implementación conceptual

```typescript
class ChromeStorageDriver implements IChromeStorageDriver {
  async getLocal<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  }
  
  async setLocal<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }
  
  async clearLocal(prefix?: string): Promise<void> {
    if (!prefix) {
      await chrome.storage.local.clear();
      return;
    }
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(prefix));
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
  
  onLocalChanged(key: string, handler): () => void {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      if (!(key in changes)) return;
      const change = changes[key];
      handler(change.newValue, change.oldValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  
  // ... métodos session equivalents
}
```

### 3.3 Consideraciones MV3

- `chrome.storage.local.get(null)` retorna todo el storage — útil para prefix queries pero puede ser pesado si hay muchos datos.
- `chrome.storage.local.set` es atómico por key, no por batch. Si necesitas atomicidad multi-key, agrupa en un solo objeto.
- `chrome.storage.onChanged` se dispara en todos los contexts (SW, popup, sidepanel) — útil para sync.
- Los writes son async; si el SW muere a mitad, el write no se completa (aceptable).

---

## 4. Schemas Zod

### 4.1 Account schema

```typescript
// src/storage/schemas/accountSchema.ts

const accountTypeSchema = z.literal('prepaid');  // Fase 1

const reconnectPolicySchema = z.object({
  enabled: z.boolean(),
  maxRetries: z.number().int().min(1).max(10),
  backoffStrategy: z.enum(['fixed', 'exponential']),
  initialDelayMs: z.number().int().min(5_000).max(600_000),
  maxDelayMs: z.number().int().min(5_000).max(3_600_000),
  onZeroBalance: z.enum(['stop', 'switch']),
  notifyOnReconnect: z.boolean(),
});

const accountSchema = z.object({
  id: z.string().regex(/^acc_[a-z0-9]{16}$/),
  alias: z.string().min(1).max(50),
  username: z.string().regex(/^[a-zA-Z0-9._-]+(@nauta\.(com|co)\.cu)?$/),
  encryptedPassword: z.string().min(1),
  type: accountTypeSchema,
  reconnectPolicy: reconnectPolicySchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  lastUsed: z.number().int().positive().nullable(),
  isSelected: z.boolean(),
});

type Account = z.infer<typeof accountSchema>;
```

### 4.2 SessionData schema

```typescript
const sessionDataSchema = z.object({
  accountId: z.string().regex(/^acc_[a-z0-9]{16}$/),
  username: z.string(),
  csrfToken: z.string().regex(/^[a-f0-9]{32}$/),
  attributeUuid: z.string().alphanumeric().min(16).max(128),
  wlanUserIp: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),
  loggerId: z.string(),
  startedAt: z.number().int().positive(),
  lastSync: z.number().int().positive(),
  cookies: z.record(z.string(), z.string()),
  loginStrategy: z.enum([
    'KnownEndpoint', 'DiscoveredEndpoint',
    'ScrapingDom', 'ScrapingRegex', 'ManualFallback',
  ]),
});
```

### 4.3 Settings schema

```typescript
const themeSettingSchema = z.object({
  mode: z.enum(['manual', 'system']),
  theme: z.enum(['dark', 'light', 'nebula', 'aurora']),
});

const behaviorSettingsSchema = z.object({
  restoreSessionOnStartup: z.boolean(),
  autoReconnectGlobal: z.boolean(),
  startWithBrowser: z.boolean(),
  onPopupClose: z.enum(['keep_session', 'logout']),
});

const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  onDisconnect: z.boolean(),
  onReconnect: z.boolean(),
  onLowBalance: z.boolean(),
  lowBalanceThreshold: z.number().min(0).max(1000),
  onLowTime: z.boolean(),
  lowTimeThresholdMinutes: z.number().int().min(1).max(1440),
  onConnectorError: z.boolean(),
  verbosity: z.enum(['minimal', 'normal', 'detailed']),
});

const securitySettingsSchema = z.object({
  autoLockMinutes: z.number().int().min(0).max(1440),
  requireUnlockOnOpen: z.boolean(),
});

const developerSettingsSchema = z.object({
  visible: z.boolean(),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
  verboseNetwork: z.boolean(),
  traceStrategies: z.boolean(),
});

const settingsSchema = z.object({
  theme: themeSettingSchema,
  behavior: behaviorSettingsSchema,
  notifications: notificationSettingsSchema,
  security: securitySettingsSchema,
  developer: developerSettingsSchema,
  schemaVersion: z.literal(1),
  updatedAt: z.number().int().positive(),
});
```

### 4.4 SchedulerTask schema

```typescript
const schedulerTriggerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('delay'),
    minutes: z.number().int().min(1).max(1440),
  }),
  z.object({
    kind: z.literal('atTime'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  }),
  z.object({
    kind: z.literal('maxSession'),
    hours: z.number().int().min(1).max(72),
  }),
]);

const schedulerTaskSchema = z.object({
  id: z.string().regex(/^sch_[a-z0-9]{16}$/),
  type: z.enum(['LOGOUT_TIMER', 'LOGOUT_TIME', 'MAX_SESSION_TIME']),
  trigger: schedulerTriggerSchema,
  enabled: z.boolean(),
  accountId: z.string().regex(/^acc_[a-z0-9]{16}$/).nullable(),
  createdAt: z.number().int().positive(),
  nextRunAt: z.number().int().positive().nullable(),
  lastExecutedAt: z.number().int().positive().nullable(),
  status: z.enum(['pending', 'executing', 'completed', 'failed', 'cancelled']),
  lastError: z.any().nullable(),  // NexaError, ver nexaErrorSchema
  recurring: z.boolean(),
});
```

### 4.5 LogEntry schema

```typescript
const logLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);
const logCategorySchema = z.enum([
  'system', 'session', 'account', 'scheduler', 'connector',
  'network', 'storage', 'crypto', 'theme', 'notification',
  'connection', 'ui',
]);

const diagnosticLogSchema = z.object({
  id: z.string().regex(/^log_[a-z0-9]{16}$/),
  timestamp: z.number().int().positive(),
  level: logLevelSchema,
  category: logCategorySchema,
  message: z.string(),
  details: z.unknown().optional(),
  traceId: z.string().optional(),
});
```

### 4.6 NexaError schema

```typescript
const nexaErrorCodeSchema = z.enum([
  // AUTH
  'AUTH_INVALID_CREDENTIALS', 'AUTH_RATE_LIMITED', 'AUTH_ACCOUNT_BLOCKED', 'AUTH_UNKNOWN_FAILURE',
  // SESSION
  'SESSION_EXPIRED', 'SESSION_IN_USE', 'SESSION_NOT_FOUND', 'SESSION_ALREADY_ACTIVE',
  // NETWORK
  'NETWORK_TIMEOUT', 'NETWORK_DNS', 'NETWORK_OFFLINE', 'PORTAL_UNREACHABLE',
  // CONNECTOR
  'CONNECTOR_PARSER_FAILED', 'CONNECTOR_CSRF_MISSING', 'CONNECTOR_ATTRIBUTE_UUID_MISSING', 'CONNECTOR_DEGRADED',
  // BALANCE
  'BALANCE_ZERO', 'BALANCE_UNAVAILABLE',
  // STORAGE
  'STORAGE_WRITE_FAILED', 'STORAGE_READ_FAILED', 'STORAGE_FULL', 'STORAGE_CORRUPT',
  // CRYPTO
  'CRYPTO_INVALID_MASTER_PASSWORD', 'CRYPTO_NOT_INITIALIZED', 'CRYPTO_LOCKED',
  'CRYPTO_DECRYPT_FAILED', 'CRYPTO_ENCRYPT_FAILED',
  // SCHEDULER
  'SCHEDULER_TASK_NOT_FOUND', 'SCHEDULER_INVALID_TRIGGER',
  // VALIDATION
  'VALIDATION_FAILED',
  // UNKNOWN
  'UNKNOWN_ERROR',
]);

const nexaErrorCategorySchema = z.enum([
  'AUTH_ERROR', 'SESSION_ERROR', 'NETWORK_ERROR', 'CONNECTOR_ERROR',
  'STORAGE_ERROR', 'CRYPTO_ERROR', 'SCHEDULER_ERROR', 'VALIDATION_ERROR',
  'UNKNOWN_ERROR',
]);

const nexaErrorSchema = z.object({
  code: nexaErrorCodeSchema,
  category: nexaErrorCategorySchema,
  technicalMessage: z.string(),
  userMessage: z.string(),
  recommendedAction: z.string(),
  retryable: z.boolean(),
  cause: z.unknown().optional(),
  timestamp: z.number().int().positive(),
  traceId: z.string().optional(),
});
```

### 4.7 Backup schema

```typescript
const backupDataSchema = z.object({
  accounts: z.array(accountSchema),
  settings: settingsSchema,
  history: z.array(sessionRecordSchema),
  scheduler: z.array(schedulerTaskSchema),
  preferences: z.record(z.string(), z.unknown()),
});

const backupPackageSchema = z.object({
  version: z.literal(1),
  createdAt: z.number().int().positive(),
  extensionVersion: z.string(),
  schemaVersions: z.record(z.string(), z.number()),
  installationId: z.string(),
  data: backupDataSchema,
  checksum: z.string().length(64),
});
```

---

## 5. Migrations

### 5.1 Sistema de versionado

Cada namespace tiene un `schemaVersion` en `nexa.meta.schemaVersions.{namespace}`. Al iniciar la extensión, `StorageEngine.migrateAll()` ejecuta migrations necesarias.

```typescript
// src/storage/migrations/index.ts

interface Migration {
  from: number;
  to: number;
  description: string;
  migrate(stored: unknown): Promise<unknown>;
}

const MIGRATIONS: Readonly<Record<string, readonly Migration[]>> = {
  accounts: [
    // (vacío en v1 — no hay migraciones aún)
  ],
  sessions: [
    // (vacío en v1)
  ],
  settings: [
    // (vacío en v1)
  ],
  // ... etc
};
```

### 5.2 Ejemplo de migración futura (v1 → v2)

```typescript
// Hipotético: si en v2 agregamos `lastBalance` a Account
const accountsV1ToV2: Migration = {
  from: 1,
  to: 2,
  description: 'Add lastBalance field to accounts',
  migrate: async (stored) => {
    if (!Array.isArray(stored)) return stored;
    return stored.map(account => ({
      ...account,
      lastBalance: null,  // nuevo campo default
    }));
  },
};
```

### 5.3 Orquestador

```typescript
class StorageEngine {
  async migrateAll(): Promise<Result<void, NexaError>> {
    const meta = await this.metaRepo.get();
    const currentVersions = meta?.schemaVersions ?? {};
    
    for (const [namespace, migrations] of Object.entries(MIGRATIONS)) {
      const currentVersion = currentVersions[namespace] ?? 1;
      
      for (const migration of migrations) {
        if (migration.from !== currentVersion) continue;
        
        try {
          await this.runMigration(namespace, migration);
          await this.metaRepo.setSchemaVersion(namespace, migration.to);
          this.diagnostics.info('storage', `Migración completada: ${namespace} v${migration.from} → v${migration.to}`);
        } catch (error) {
          this.diagnostics.error('storage', `Migración fallida: ${namespace}`, { error });
          return Err({
            code: 'STORAGE_CORRUPT',
            category: 'STORAGE_ERROR',
            userMessage: 'Error al migrar datos. Contacta soporte.',
            technicalMessage: String(error),
            recommendedAction: 'Reinstalar la extensión',
            retryable: false,
            timestamp: Date.now(),
          });
        }
      }
    }
    
    return Ok(void);
  }
}
```

### 5.4 Política

- Migrations son **siempre hacia adelante** — no hay rollback.
- Antes de migrar, se hace backup automático en `nexa.meta.lastBackupBeforeMigration`.
- Si una migración falla, se restaura el backup y se reporta el error.
- En Fase 1, todas las versiones son 1 — no hay migraciones que ejecutar. Pero el sistema está listo.

---

## 6. Backup y Restore

### 6.1 Export

```typescript
async exportAll(): Promise<BackupPackage> {
  const [accounts, settings, history, scheduler, preferences] = await Promise.all([
    this.accounts.list(),
    this.settings.get(),
    this.history.list(1000),  // máximo
    this.scheduler.list(),
    this.preferences.getAll(),
  ]);
  
  const meta = await this.meta.get();
  
  const data: BackupData = {
    accounts,
    settings,
    history,
    scheduler,
    preferences,
  };
  
  const checksum = await computeSHA256(JSON.stringify(data));
  
  return {
    version: 1,
    createdAt: Date.now(),
    extensionVersion: meta.extensionVersion,
    schemaVersions: meta.schemaVersions,
    installationId: meta.installationId,
    data,
    checksum,
  };
}
```

### 6.2 Import

```typescript
async importAll(package_: BackupPackage): Promise<Result<void, NexaError>> {
  // 1. Validar schema
  const parsed = backupPackageSchema.safeParse(package_);
  if (!parsed.success) {
    return Err({
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION_ERROR',
      userMessage: 'Archivo de backup inválido.',
      technicalMessage: parsed.error.message,
      recommendedAction: 'Verifica que el archivo sea un backup de NEXA NautaX.',
      retryable: false,
      timestamp: Date.now(),
    });
  }
  
  // 2. Verificar checksum
  const computedChecksum = await computeSHA256(JSON.stringify(parsed.data.data));
  if (computedChecksum !== parsed.data.checksum) {
    return Err({
      code: 'STORAGE_CORRUPT',
      category: 'STORAGE_ERROR',
      userMessage: 'El backup está corrupto.',
      technicalMessage: 'Checksum mismatch',
      recommendedAction: 'El archivo fue modificado. Usa otro backup.',
      retryable: false,
      timestamp: Date.now(),
    });
  }
  
  // 3. Verificar versión compatible
  if (parsed.data.version !== 1) {
    return Err({
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION_ERROR',
      userMessage: 'Versión de backup no soportada.',
      technicalMessage: `Backup version: ${parsed.data.version}`,
      recommendedAction: 'Actualiza NEXA NautaX a la última versión.',
      retryable: false,
      timestamp: Date.now(),
    });
  }
  
  // 4. Advertir si installationId difiere
  const currentMeta = await this.meta.get();
  if (parsed.data.installationId !== currentMeta.installationId) {
    // Las credenciales no se podrán descifrar (diferente salt)
    // Preguntar al usuario si quiere importar de todos modos
    // (esto lo maneja la UI, aquí solo retornamos error que UI interpreta)
    return Err({
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION_ERROR',
      userMessage: 'Backup de otra instalación. Las credenciales no se pueden migrar.',
      technicalMessage: `Installation ID mismatch: ${parsed.data.installationId} vs ${currentMeta.installationId}`,
      recommendedAction: 'Importar sin credenciales o reingresarlas manualmente.',
      retryable: true,  // UI puede elegir "importar sin credenciales"
      timestamp: Date.now(),
    });
  }
  
  // 5. Migrar si es necesario
  for (const [namespace, version] of Object.entries(parsed.data.schemaVersions)) {
    if (version < (currentMeta.schemaVersions[namespace] ?? 1)) {
      // aplicar migraciones al data importado
      // (no implementado en Fase 1 — todas las versiones son 1)
    }
  }
  
  // 6. Limpiar storage actual
  await this.clear();
  
  // 7. Escribir nuevos datos
  await this.accounts.saveAll(parsed.data.data.accounts);
  await this.settings.save(parsed.data.data.settings);
  await this.history.saveAll(parsed.data.data.history);
  await this.scheduler.saveAll(parsed.data.data.scheduler);
  await this.preferences.saveAll(parsed.data.data.preferences);
  
  return Ok(void);
}
```

---

## 7. Sincronización SW ↔ UI

### 7.1 Mecanismo

**Una sola vía**: `chrome.storage.onChanged` (F2-D4).

```
SW escribe en chrome.storage.local
        │
        ▼
chrome.storage.onChanged event se dispara en todos los contexts:
  - SW
  - popup (si abierto)
  - sidepanel (si abierto)
        │
        ▼
Cada store Zustand tiene un listener:
  store.subscribeToStorage()
        │
        ▼
Listener actualiza estado Zustand
        │
        ▼
React re-renderiza automáticamente
```

### 7.2 Implementación del middleware

```typescript
// src/store/middleware/storageSync.ts

import { StateCreator, StoreApi } from 'zustand';

interface StorageSyncOptions<T> {
  storageKey: string;
  storageArea: 'local' | 'session';
  hydrate: (stored: unknown) => Partial<T>;
  serialize: (state: T) => unknown;
}

function storageSync<T extends object>(
  options: StorageSyncOptions<T>
): StateCreator<T, [], [], T> {
  return (set, get) => {
    // Hidratar inicialmente
    const driver = getDriver(options.storageArea);
    driver.get(options.storageKey).then(stored => {
      if (stored) {
        set(options.hydrate(stored));
      }
    });
    
    // Suscribirse a cambios
    driver.onChanged(options.storageKey, (newValue) => {
      if (newValue) {
        set(options.hydrate(newValue));
      } else {
        // key was removed
        set(options.hydrate(null));
      }
    });
    
    return {} as T;  // estado inicial definido por store
  };
}
```

### 7.3 Anti-patrón

**Prohibido**: enviar `chrome.runtime.sendMessage` desde el SW a la UI para notificar cambios de estado. Eso crearía dos vías de sincronización y rompería la unicidad.

**Excepción**: `chrome.runtime.sendMessage` se usa SOLO para:
- Solicitudes de UI al SW (UI → SW).
- Eventos efímeros no persistidos (ej: "abrir sidepanel").

---

## 8. Estimación de uso de storage

| Namespace | Tamaño por item | Items típicos | Total estimado |
|-----------|----------------|---------------|----------------|
| `accounts.*` | ~500 bytes | 1-5 cuentas | 2.5 KB |
| `sessions.*` | ~1 KB | 1 activo + snapshot | 2 KB |
| `history.*` | ~300 bytes | 50-500 registros | 150 KB |
| `settings` | ~1 KB | 1 | 1 KB |
| `scheduler.*` | ~200 bytes | 0-5 tareas | 1 KB |
| `logs.entries` | ~200 bytes | 5,000 (max) | 1 MB |
| `logs.network` | ~150 bytes | 1,000 (max) | 150 KB |
| `notifications.active` | ~300 bytes | 0-20 | 6 KB |
| `crypto.*` | ~500 bytes | 1 | 500 bytes |
| `meta` | ~200 bytes | 1 | 200 bytes |
| **Total típico** | | | **~1.3 MB** |

Bien dentro del límite de 10 MB de `chrome.storage.local`.

---

## 9. Política de limpieza

### 9.1 Automática

- **Logs**: FIFO a 5,000 entries.
- **Network records**: FIFO a 1,000.
- **History**: FIFO a 1,000.
- **Notifications**: auto-dismiss según duration (si no persistent).

### 9.2 Manual (desde Developer Mode o Settings)

- "Limpiar logs" → `storage.logs.clear()`
- "Limpiar historial" → `storage.history.clear()`
- "Limpiar caché" → `storage.clear()` (borra todo excepto `nexa.crypto.verifier` y `nexa.meta.installationId`)
- "Restablecer extensión" → `storage.clear()` completo + recreate master password

### 9.3 Programada (futura)

- Setting "Auto-limpiar logs después de X días" (no en Fase 1, pero el campo está reservado).
- En startup, ejecutar limpieza si procede.

---

## 10. Pendientes para Fases siguientes

### Fase 5
- Implementar `ChromeStorageDriver`.
- Implementar todos los repositories.
- Implementar Zod schemas en `src/storage/schemas/`.
- Implementar `StorageEngine` facade.
- Implementar migrations orquestador (sin migraciones reales en v1).

### Fase 6
- Repositories de sesión y balance son usados por `SessionManager` y `EtecsaConnector`.

### Fase 7
- Settings UI consume `SettingsRepository`.
- Developer Mode → Storage Viewer lee directamente de storage.

### Fase 8
- Tests de repositories con mocked `chrome.storage`.
- Tests de migrations.
- Tests de backup/restore.

---

**Fin del Documento 3.**
Continúa en `04-error-handling-specification.md`.
