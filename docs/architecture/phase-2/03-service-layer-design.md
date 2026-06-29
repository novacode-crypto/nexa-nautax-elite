# NEXA NautaX — Service Layer Design

**Fase:** 2
**Documento:** 3 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Definición de interfaces, responsabilidades y dependencias de los 9 servicios del SW. **No es implementación** — solo contratos. La implementación real ocurre en Fases 5-7.

---

## 1. Visión General

### 1.1 Filosofía

- Servicios **stateless**: cero estado en memoria. Toda lectura/escritura va por `StorageEngine`.
- Servicios **singleton lógicos**: una sola instancia conceptual, pero no son singletons literales — el SW puede recrearlos.
- Servicios **event-driven**: publican eventos al `EventBus` y se suscriben a eventos de otros servicios.
- Servicios **Result-returning**: nunca lanzan excepciones; siempre devuelven `Result<T, NexaError>`.

### 1.2 Mapa de servicios y dependencias

```
                  ┌──────────────────┐
                  │  SessionManager  │
                  └──────┬─────┬─────┘
                         │     │
            ┌────────────┘     └────────────┐
            ▼                                ▼
  ┌──────────────────┐            ┌──────────────────┐
  │ AccountManager   │            │ SchedulerEngine  │
  └──────┬───────────┘            └──────┬───────────┘
         │                               │
         │   ┌───────────────────────────┘
         ▼   ▼
  ┌──────────────────┐    ┌──────────────────┐
  │ StorageEngine    │◄───┤ NotificationEng. │
  └──────┬───────────┘    └──────────────────┘
         │
         ▼
  ┌──────────────────┐    ┌──────────────────┐
  │ DiagnosticEngine │◄───┤  CryptoService   │
  └──────────────────┘    └──────────────────┘
         ▲
         │
  ┌──────────────────┐    ┌──────────────────┐
  │ ConnectionMonitor│    │  ThemeService    │
  └──────────────────┘    └──────────────────┘
```

### 1.3 Convención de nombres

- Métodos públicos: **verbos** (`login`, `logout`, `getBalance`).
- Métodos privados: prefijo `handle` (`handleLogin`, `handleAlarm`).
- Handlers de message bus: `handle{MessageType}` (`handleSessionLogin`).
- Eventos publicados: en pasado (`SESSION_STARTED`, no `SESSION_START`).

---

## 2. SessionManager

**Archivo:** `src/services/session/SessionManager.ts`

### 2.1 Responsabilidad

Único punto de control del ciclo de vida de la sesión ETECSA. Mantiene el estado de sesión persistido en storage y orquesta llamadas al `EtecsaConnector`.

### 2.2 Estado gestionado

SessionManager **no mantiene estado en memoria**. Todo estado vive en `chrome.storage.local` bajo el namespace `nexa.sessions.*`:

```
nexa.sessions.active       → SessionData | null
nexa.sessions.lastError    → NexaError | null
nexa.sessions.history[]    → SessionRecord[] (ver HistoryRepository)
```

### 2.3 Interfaz pública

```typescript
interface ISessionManager {
  // —— Ciclo de vida ——
  login(accountId: AccountId): Promise<Result<SessionData, NexaError>>;
  logout(): Promise<Result<void, NexaError>>;
  reconnect(): Promise<Result<SessionData, NexaError>>;
  refresh(): Promise<Result<SessionInfo, NexaError>>;

  // —— Consultas ——
  getActiveSession(): Promise<SessionData | null>;
  getStatus(): Promise<SessionStatus>;
  getTimeRemaining(): Promise<Result<Duration, NexaError>>;
  getBalance(): Promise<Result<Balance, NexaError>>;

  // —— Eventos (publica) ——
  // SESSION_STARTED, SESSION_LOST, SESSION_EXPIRED, SESSION_REFRESHED, BALANCE_UPDATED, BALANCE_LOW

  // —— Eventos (escucha) ——
  // CONNECTION_OFFLINE, CONNECTION_CAPTIVE_PORTAL
}

type SessionStatus =
  | { kind: 'OFFLINE' }
  | { kind: 'CAPTIVE_PORTAL' }
  | { kind: 'CONNECTING' }
  | { kind: 'AUTHENTICATED'; session: SessionData }
  | { kind: 'SESSION_EXPIRED' }
  | { kind: 'ERROR'; error: NexaError };
```

### 2.4 Dependencias

```typescript
interface SessionManagerDeps {
  readonly connector: IEtecsaConnector;
  readonly accountManager: IAccountManager;
  readonly storage: IStorageEngine;
  readonly crypto: ICryptoService;
  readonly scheduler: ISchedulerEngine;
  readonly notification: INotificationEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly connection: IConnectionMonitor;
  readonly eventBus: IEventBus;
}
```

### 2.5 Política de decisiones

| Situación | Acción |
|-----------|--------|
| Login solicitado pero `connectionState = OFFLINE` | Retornar error `NETWORK_OFFLINE` sin llamar al connector. |
| Login solicitado pero `connectionState = AUTHENTICATED` | Retornar error `SESSION_IN_USE` con cuenta activa. |
| Login exitoso | Persistir `SessionData`, publicar `SESSION_STARTED`, crear `HistoryRecord`, iniciar timer. |
| Logout exitoso | Eliminar `SessionData` activo, publicar `SESSION_LOST` con `reason='manual'`, cerrar `HistoryRecord`. |
| Logout falla con `SESSION_NOT_FOUND` | Considerar éxito (sesión ya está cerrada). Limpiar estado local. |
| `BALANCE_UPDATED` con amount < threshold | Publicar `BALANCE_LOW`. |
| `SESSION_LOST` recibido del ConnectionMonitor | Actualizar estado, notificar al usuario, ejecutar política de reconnect (D03). |

### 2.6 Politica de reconnect (D03)

```typescript
// Lógica conceptual
async function handleSessionLost(reason: DisconnectReason): Promise<void> {
  const session = await getActiveSession();
  if (!session) return;

  const account = await accountManager.getById(session.accountId);
  if (!account?.reconnectPolicy.enabled) {
    publishSessionLost(reason);
    return;
  }

  if (account.reconnectPolicy.onZeroBalance === 'stop' && reason === 'BALANCE_ZERO') {
    publishSessionLost(reason);
    return;
  }

  for (let attempt = 1; attempt <= account.reconnectPolicy.maxRetries; attempt++) {
    const delay = computeBackoff(attempt, account.reconnectPolicy);
    await sleep(delay);

    const result = await reconnect();
    if (result.ok) {
      publishSessionReconnected(attempt);
      return;
    }
  }

  publishSessionLost(reason);
  notification.warning('No se pudo reconectar automáticamente.');
}
```

---

## 3. AccountManager

**Archivo:** `src/services/accounts/AccountManager.ts`

### 3.1 Responsabilidad

CRUD de cuentas Nauta. Cifra credenciales antes de persistir. Valida estructura con Zod. Expone selección de cuenta activa.

### 3.2 Estado gestionado

```
nexa.accounts.list[]        → Account[] (sin contraseñas, solo encryptedPassword)
nexa.accounts.selectedId    → AccountId | null
nexa.accounts.meta          → { schemaVersion: number, lastModified: number }
```

### 3.3 Interfaz pública

```typescript
interface IAccountManager {
  // —— CRUD ——
  create(input: NewAccountInput): Promise<Result<Account, NexaError>>;
  update(accountId: AccountId, input: AccountUpdateInput): Promise<Result<Account, NexaError>>;
  delete(accountId: AccountId): Promise<Result<void, NexaError>>;
  list(): Promise<readonly Account[]>;
  getById(accountId: AccountId): Promise<Account | null>;

  // —— Selección ——
  select(accountId: AccountId): Promise<Result<void, NexaError>>;
  getSelected(): Promise<Account | null>;

  // —— Validación de credenciales ——
  verifyCredentials(accountId: AccountId): Promise<Result<CredentialsVerification, NexaError>>;

  // —— Reconnect policy (D03) ——
  updateReconnectPolicy(accountId: AccountId, policy: ReconnectPolicy): Promise<Result<void, NexaError>>;
  getReconnectPolicy(accountId: AccountId): Promise<ReconnectPolicy>;

  // —— Eventos (publica) ——
  // ACCOUNT_CREATED, ACCOUNT_UPDATED, ACCOUNT_DELETED, ACCOUNT_SELECTED
}

interface NewAccountInput {
  readonly alias: string;
  readonly username: string;
  readonly password: string;            // plaintext — solo en memoria
  readonly type: 'prepaid';             // D09
  readonly reconnectPolicy?: Partial<ReconnectPolicy>;
}

interface AccountUpdateInput {
  readonly alias?: string;
  readonly username?: string;
  readonly password?: string;           // si se cambia, se re-cifra
  readonly type?: 'prepaid';
  readonly reconnectPolicy?: Partial<ReconnectPolicy>;
}

interface Account {
  readonly id: AccountId;
  readonly alias: string;
  readonly username: string;
  readonly encryptedPassword: string;   // AES-GCM ciphertext + IV
  readonly type: 'prepaid';
  readonly reconnectPolicy: ReconnectPolicy;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastUsed: number | null;
  readonly isActive: boolean;           // D02: una sola activa a la vez
}

interface ReconnectPolicy {
  readonly enabled: boolean;
  readonly maxRetries: number;          // default 3
  readonly backoffStrategy: 'fixed' | 'exponential';  // default 'exponential'
  readonly initialDelayMs: number;      // default 30000
  readonly maxDelayMs: number;          // default 300000
  readonly onZeroBalance: 'stop' | 'switch';           // default 'stop'
  readonly notifyOnReconnect: boolean;  // default true
}
```

### 3.4 Dependencias

```typescript
interface AccountManagerDeps {
  readonly storage: IStorageEngine;
  readonly crypto: ICryptoService;
  readonly connector: IEtecsaConnector;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

### 3.5 Validaciones

```typescript
// Zod schema (en features/accounts/schema.ts)
const newAccountSchema = z.object({
  alias: z.string().min(1).max(50),
  username: z.string()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Usuario inválido')
    .refine(u => !u.includes('@') || u.endsWith('@nauta.com.cu') || u.endsWith('@nauta.co.cu'),
      'Dominio de email no soportado'),
  password: z.string().min(1).max(100),
  type: z.literal('prepaid'),
  reconnectPolicy: reconnectPolicySchema.optional(),
});
```

### 3.6 Anti-responsabilidades

- No hace login — eso es `SessionManager`.
- No conoce el formato de `SessionData` — eso es del connector.
- No decide cuándo seleccionar cuenta automáticamente — eso es UX/UI.

---

## 4. SchedulerEngine

**Archivo:** `src/services/scheduler/SchedulerEngine.ts`

### 4.1 Responsabilidad

Programa y ejecuta tareas diferidas. Usa `chrome.alarms` (F2-D5). Tipos de tareas: logout temporizado, logout a hora específica, tiempo máximo de sesión.

### 4.2 Estado gestionado

```
nexa.scheduler.tasks[]      → SchedulerTask[]
nexa.scheduler.alarms       → Map<alarmName, taskId>  // para lookup inverso
```

### 4.3 Interfaz pública

```typescript
interface ISchedulerEngine {
  // —— Tareas ——
  createTask(input: NewSchedulerTaskInput): Promise<Result<SchedulerTask, NexaError>>;
  cancelTask(taskId: SchedulerTaskId): Promise<Result<void, NexaError>>;
  listTasks(): Promise<readonly SchedulerTask[]>;
  getTask(taskId: SchedulerTaskId): Promise<SchedulerTask | null>;

  // —— Ejecución ——
  handleAlarm(alarmName: string): Promise<void>;  // llamado por SW onAlarm

  // —— Eventos (publica) ——
  // SCHEDULER_TASK_FIRED, SCHEDULER_TASK_COMPLETED

  // —— Eventos (escucha) ——
  // SESSION_STARTED (para arrancar timers de sesión)
  // SESSION_LOST (para cancelar timers huérfanos)
}

interface NewSchedulerTaskInput {
  readonly type: SchedulerTaskType;
  readonly trigger: SchedulerTrigger;
  readonly enabled: boolean;
}

type SchedulerTaskType =
  | 'LOGOUT_TIMER'           // logout en X minutos
  | 'LOGOUT_TIME'            // logout a hora específica
  | 'MAX_SESSION_TIME';      // logout si sesión supera X horas

type SchedulerTrigger =
  | { kind: 'delay'; minutes: 30 | 60 | 120 | number }
  | { kind: 'atTime'; hour: number; minute: number }
  | { kind: 'maxSession'; hours: number };

interface SchedulerTask {
  readonly id: SchedulerTaskId;
  readonly type: SchedulerTaskType;
  readonly trigger: SchedulerTrigger;
  readonly enabled: boolean;
  readonly createdAt: number;
  readonly executedAt: number | null;
  readonly status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  readonly lastError: NexaError | null;
}
```

### 4.4 Mapeo a chrome.alarms

```typescript
// Cada SchedulerTask crea un chrome.alarm
function toAlarmName(taskId: SchedulerTaskId): string {
  return `nexa.scheduler.${taskId}`;
}

function toAlarmInfo(trigger: SchedulerTrigger): chrome.alarms.AlarmCreateInfo {
  switch (trigger.kind) {
    case 'delay':
      return { delayInMinutes: trigger.minutes };
    case 'atTime':
      return { when: computeNextOccurrence(trigger.hour, trigger.minute) };
    case 'maxSession':
      return { delayInMinutes: trigger.hours * 60 };
  }
}
```

### 4.5 Dependencias

```typescript
interface SchedulerEngineDeps {
  readonly storage: IStorageEngine;
  readonly session: ISessionManager;
  readonly notification: INotificationEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

### 4.6 Consideraciones MV3

- `chrome.alarms` tiene granularidad **mínima 1 minuto** en producción (30s en unpacked).
- Alarms **no persisten tras reinicio del navegador** — se pierden al cerrar Chrome.
- Alarms **sí persisten tras reinicio del SW** — Chrome las mantiene.
- En `onStartup`, el engine debe recargar tasks desde storage y re-registrar alarms para tareas pendientes no ejecutadas.

---

## 5. NotificationEngine

**Archivo:** `src/services/notification/NotificationEngine.ts`

### 5.1 Responsabilidad

Mostrar notificaciones al usuario via Toast System NEXA custom (D10). NO usa `chrome.notifications` nativas. Expone badges y cambios de icono de la extensión.

### 5.2 Tipos de notificación

```typescript
type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

interface NotificationInput {
  readonly variant: NotificationVariant;
  readonly title: string;          // español
  readonly message?: string;       // español
  readonly action?: {
    readonly label: string;        // español
    readonly type: 'open_sidepanel' | 'open_popup' | 'dismiss';
  };
  readonly durationMs?: number;    // default: 5000 (success/info), 8000 (warning), 0/no-auto (error)
  readonly persistent?: boolean;   // si true, no auto-dismiss
}

interface ActiveNotification extends NotificationInput {
  readonly id: NotificationId;
  readonly createdAt: number;
}
```

### 5.3 Interfaz pública

```typescript
interface INotificationEngine {
  // —— API directa (usada por servicios) ——
  success(title: string, message?: string): Promise<NotificationId>;
  error(title: string, message?: string, action?: NotificationInput['action']): Promise<NotificationId>;
  warning(title: string, message?: string): Promise<NotificationId>;
  info(title: string, message?: string): Promise<NotificationId>;

  // —— Gestión ——
  dismiss(notificationId: NotificationId): Promise<void>;
  dismissAll(): Promise<void>;
  listActive(): Promise<readonly ActiveNotification[]>;

  // —— Badges e iconos ——
  updateActionIcon(state: ActionIconState): Promise<void>;
  setBadgeText(text: string | null): Promise<void>;
  setBadgeColor(color: string): Promise<void>;

  // —— Eventos (escucha) ——
  // SESSION_LOST, BALANCE_LOW, CONNECTOR_DEGRADED, SCHEDULER_TASK_COMPLETED
}

type ActionIconState = 'connected' | 'reconnecting' | 'disconnected' | 'no-account' | 'error';
```

### 5.4 Cómo funcionan los toasts sin chrome.notifications

1. `NotificationEngine` persiste notificaciones activas en `chrome.storage.local` bajo `nexa.notifications.active[]`.
2. UI (popup y sidepanel) tiene un `ToastProvider` que escucha `chrome.storage.onChanged` para `nexa.notifications.active`.
3. Cuando se agrega una notificación, ambos surfaces la muestran si están abiertos.
4. Auto-dismiss: un `chrome.alarms` con delay igual a `durationMs` dispara el dismiss.

### 5.5 Badges

```typescript
// Cuando hay eventos críticos no vistos
await notificationEngine.setBadgeText('3');
await notificationEngine.setBadgeColor('#ef4444');

// Cuando no hay
await notificationEngine.setBadgeText(null);
```

### 5.6 Iconos de acción (F2-D10)

```typescript
// Cambiar icono según estado de sesión
async function updateActionIcon(state: ActionIconState): Promise<void> {
  const path = {
    '16': `public/icons/icon-states/${state}-16.png`,
    '32': `public/icons/icon-states/${state}-32.png`,
    '48': `public/icons/icon-states/${state}-48.png`,
    '128': `public/icons/icon-states/${state}-128.png`,
  };
  await chrome.action.setIcon({ path });
}
```

### 5.7 Dependencias

```typescript
interface NotificationEngineDeps {
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

---

## 6. StorageEngine

**Archivo:** `src/services/storage/StorageEngine.ts`

### 6.1 Responsabilidad

Abstracción tipada sobre `chrome.storage.local`. Centraliza acceso a storage para facilitar migraciones y auditoría. Delega a `repositories/` para operaciones por entidad.

### 6.2 Interfaz pública

```typescript
interface IStorageEngine {
  // —— Operaciones primitivas ——
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;  // si prefix, solo keys que empiezan con ese prefix

  // —— Operaciones por namespace ——
  getNamespace<T>(namespace: string): Promise<Record<string, T>>;

  // —— Migraciones ——
  getVersion(namespace: string): Promise<number>;
  migrate(namespace: string, targetVersion: number): Promise<Result<void, NexaError>>;

  // —— Backup ——
  exportAll(): Promise<BackupPackage>;
  importAll(package_: BackupPackage): Promise<Result<void, NexaError>>;

  // —— Eventos ——
  onChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void;
}
```

### 6.3 Repositories

Cada repositorio encapsula un namespace:

```typescript
interface IAccountRepository {
  list(): Promise<readonly Account[]>;
  getById(id: AccountId): Promise<Account | null>;
  save(account: Account): Promise<void>;
  delete(id: AccountId): Promise<void>;
  clear(): Promise<void>;
}

// Similar para: SessionRepository, HistoryRepository, SettingsRepository,
// SchedulerRepository, LogRepository, MetaRepository
```

### 6.4 Namespaces

```typescript
// src/storage/namespaces.ts
export const NAMESPACES = {
  accounts: 'nexa.accounts',
  sessions: 'nexa.sessions',
  history: 'nexa.history',
  settings: 'nexa.settings',
  scheduler: 'nexa.scheduler',
  logs: 'nexa.logs',
  notifications: 'nexa.notifications',
  preferences: 'nexa.preferences',
  meta: 'nexa.meta',           // schemaVersions, installationId
} as const;
```

### 6.5 Versionado (F2-D13)

Cada namespace tiene un `schemaVersion` en `nexa.meta.{namespace}.schemaVersion`:

```
nexa.meta.accounts.schemaVersion     = 1
nexa.meta.sessions.schemaVersion     = 1
nexa.meta.settings.schemaVersion     = 1
...
```

Cuando se cambia el schema de una entidad, se incrementa la versión y se escribe una función de migración en `storage/migrations/`.

### 6.6 Anti-responsabilidades

- No valida datos — eso lo hacen los `schemas/` con Zod antes de llamar al repo.
- No cifra — eso lo hace `CryptoService` antes de llamar al repo.
- No hace lógica de negocio — eso lo hacen los services.

---

## 7. DiagnosticEngine

**Archivo:** `src/services/diagnostics/DiagnosticEngine.ts`

### 7.1 Responsabilidad

Logger central del SW. Recibe logs de todos los servicios y connectors. Sanitiza antes de persistir. Expone consultas para Developer Mode.

### 7.2 Interfaz pública

```typescript
interface IDiagnosticEngine {
  // —— Logging ——
  log(level: LogLevel, category: string, message: string, details?: unknown): Promise<void>;
  debug(category: string, message: string, details?: unknown): Promise<void>;
  info(category: string, message: string, details?: unknown): Promise<void>;
  warn(category: string, message: string, details?: unknown): Promise<void>;
  error(category: string, message: string, details?: unknown): Promise<void>;
  fatal(category: string, message: string, details?: unknown): Promise<void>;

  // —— Consultas ——
  getLogs(filter?: LogFilter): Promise<readonly LogEntry[]>;
  getLogsByCategory(category: string, limit?: number): Promise<readonly LogEntry[]>;
  getLogsByLevel(level: LogLevel, limit?: number): Promise<readonly LogEntry[]>;
  getConnectorHealth(): Promise<ConnectorHealth>;
  getNetworkHistory(limit?: number): Promise<readonly NetworkRecord[]>;

  // —— Gestión ——
  clear(): Promise<void>;
  clearBefore(timestamp: number): Promise<void>;
  export(): Promise<ExportedLogs>;

  // —— Eventos (escucha) ——
  // Todos — el DiagnosticEngine se suscribe a TODOS los eventos del EventBus
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly level: LogLevel;
  readonly category: string;
  readonly message: string;
  readonly details?: unknown;
  readonly traceId?: string;
}

interface LogFilter {
  readonly level?: LogLevel | LogLevel[];
  readonly category?: string | string[];
  readonly since?: number;
  readonly until?: number;
  readonly traceId?: string;
  readonly limit?: number;
}

interface NetworkRecord {
  readonly id: string;
  readonly timestamp: number;
  readonly method: string;
  readonly url: string;
  readonly status: number | null;
  readonly durationMs: number;
  readonly error?: string;
}

interface ConnectorHealth {
  readonly lastOperation: string | null;
  readonly lastSuccessAt: number | null;
  readonly lastError: NexaError | null;
  readonly currentStrategy: StrategyName;
  readonly consecutiveFailures: number;
  readonly totalOperations: number;
  readonly totalSuccesses: number;
  readonly totalFailures: number;
}
```

### 7.3 Sanitización (F2-D18)

Antes de persistir cualquier log, el mensaje y `details` pasan por `sanitize()` (ver Doc 1 §10.3). Esto es **obligatorio** — ningún log entra a storage sin sanitizar.

### 7.4 Retención

- **Capacidad máxima**: 5,000 logs en `nexa.logs.entries[]`.
- **Política**: FIFO. Al agregar uno nuevo, si el array tiene 5,000, se elimina el más antiguo.
- **Limpieza manual**: desde Developer Mode, botón "Limpiar logs".
- **Limpieza automática opcional**: configurable en Settings (ej: "Mantener logs por 7 días").

### 7.5 Trace IDs

Operaciones multi-step (login, reconnect) generan un `traceId` al inicio y se propaga a todos los logs relacionados. Permite seguir el flujo completo en Developer Mode.

```typescript
// Ejemplo: trace de login
const traceId = generateId();
diagnostics.info('session', 'Login iniciado', { accountId, traceId });
diagnostics.debug('connector', 'Probe captive portal', { traceId });
diagnostics.debug('connector', 'Fetch login form', { traceId });
diagnostics.debug('connector', 'POST LoginServlet', { traceId });
diagnostics.info('session', 'Login completado', { accountId, traceId, durationMs });
```

### 7.6 Dependencias

```typescript
interface DiagnosticEngineDeps {
  readonly storage: IStorageEngine;
  readonly eventBus: IEventBus;
  readonly sanitizer: SanitizerFunction;  // función de sanitize
}
```

---

## 8. CryptoService

**Archivo:** `src/services/crypto/CryptoService.ts`

### 8.1 Responsabilidad

Único punto de operaciones criptográficas. Cifra/descifra credenciales. Deriva llaves de master password. Gestiona el ciclo de lock/unlock.

### 8.2 Interfaz pública

```typescript
interface ICryptoService {
  // —— Setup inicial ——
  isInitialized(): Promise<boolean>;
  createMasterPassword(masterPassword: string): Promise<Result<void, NexaError>>;

  // —— Unlock / Lock ——
  isLocked(): Promise<boolean>;
  unlock(masterPassword: string): Promise<Result<void, NexaError>>;
  lock(): Promise<void>;
  changeMasterPassword(old: string, new_: string): Promise<Result<void, NexaError>>;

  // —— Cifrado / Descifrado ——
  encrypt(plaintext: string): Promise<Result<string, NexaError>>;   // retorna base64(iv + ciphertext)
  decrypt(ciphertext: string): Promise<Result<string, NexaError>>;

  // —— Utilidades ——
  generateSecureId(): string;
  generateSecureBytes(length: number): Uint8Array;
  constantTimeCompare(a: string, b: string): boolean;
}
```

### 8.3 Estado gestionado

**En `chrome.storage.local` (persistente):**
```
nexa.crypto.salt           → base64(16 bytes) — generado en createMasterPassword
nexa.crypto.verifier       → base64(encrypt('NEXA_VERIFIER_v1', aesKey)) — para validar unlock
nexa.crypto.kdfParams      → { iterations: 250000, hash: 'SHA-256' }
nexa.crypto.createdAt      → timestamp
```

**En `chrome.storage.session` (volátil — sobrevive SW restart, se pierde al cerrar navegador):**
```
nexa.crypto.aesKey         → CryptoKey (no serializable — se mantiene como raw bytes)
nexa.crypto.derivedAt      → timestamp
```

> **Nota técnica**: `CryptoKey` no es serializable. En `chrome.storage.session` guardamos los `raw bytes` de la llave y los importamos a `CryptoKey` en cada uso. Esto es seguro porque `chrome.storage.session` no sale del navegador.

### 8.4 Flujo de unlock

```
1. Usuario ingresa master password en UI.
2. UI envía message CRYPTO_UNLOCK al SW.
3. CryptoService.unlock():
   a. Lee salt de storage.local.
   b. Deriva llave: PBKDF2(password, salt, 250000 iter, SHA-256) → 32 bytes.
   c. Importa como CryptoKey AES-GCM.
   d. Lee verifier de storage.local.
   e. Descifra verifier con la llave derivada.
   f. Si resultado === 'NEXA_VERIFIER_v1', unlock OK.
   g. Persiste raw bytes de la llave en storage.session.
   h. Publica evento CRYPTO_UNLOCKED.
4. Si verifier no coincide, retorna error CRYPTO_INVALID_MASTER_PASSWORD.
```

### 8.5 Anti-responsabilidades

- No conoce la estructura de `Account` — solo cifra strings.
- No decide cuándo pedir master password — eso es UX.
- No loggea master passwords ni llaves — sanitización obligatoria.

### 8.6 Dependencias

```typescript
interface CryptoServiceDeps {
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

---

## 9. ThemeService

**Archivo:** `src/services/theme/ThemeService.ts`

### 9.1 Responsabilidad

Aplica y persiste el tema seleccionado. Expone la lista de temas disponibles.

### 9.2 Interfaz pública

```typescript
interface IThemeService {
  // —— Consultas ——
  getCurrent(): Promise<ThemeSetting>;
  getAvailable(): readonly Theme[];

  // —— Mutaciones ——
  setManual(theme: ThemeName): Promise<void>;
  setSystem(): Promise<void>;

  // —— Aplicación ——
  apply(theme: ThemeName): void;

  // —— Eventos (escucha) ——
  // (ninguno — ThemeService es reactivo a cambios de settings)
}

type ThemeName = 'dark' | 'light' | 'nebula' | 'aurora';

type ThemeSetting =
  | { mode: 'manual'; theme: ThemeName }
  | { mode: 'system' };

interface Theme {
  readonly name: ThemeName;
  readonly label: string;        // español: 'Oscuro', 'Claro', 'Nebula', 'Aurora'
  readonly description: string;  // español
  readonly preview: { primary: string; background: string; accent: string };
}
```

### 9.3 Aplicación (F2-D8)

```typescript
function apply(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
}
```

Si `mode === 'system'`:
- Escuchar `window.matchMedia('(prefers-color-scheme: dark)')`.
- Si dark → aplicar `dark`.
- Si light → aplicar `light`.
- Nebula y Aurora no tienen equivalente sistema — solo manuales.

### 9.4 Aplicación en SW vs UI

El SW no tiene DOM — no puede aplicar temas. `ThemeService` solo aplica en contextos con `document`:
- Popup
- SidePanel
- Offscreen doc (no relevante — no es visible)

Cada surface carga su tema desde storage al iniciar y se suscribe a cambios via `chrome.storage.onChanged`.

### 9.5 Dependencias

```typescript
interface ThemeServiceDeps {
  readonly storage: IStorageEngine;
  readonly settings: ISettingsRepository;
}
```

---

## 10. ConnectionMonitor

**Archivo:** `src/services/connection/ConnectionMonitor.ts`

### 10.1 Responsabilidad

Detecta el estado de conexión del equipo: ONLINE, CAPTIVE_PORTAL, OFFLINE. Publica eventos cuando cambia. Ejecuta probes periódicos via `chrome.alarms`.

### 10.2 Interfaz pública

```typescript
interface IConnectionMonitor {
  // —— Consultas ——
  getCurrentState(): Promise<ConnectionState>;
  getLastChecked(): Promise<number | null>;

  // —— Probes manuales ——
  probe(): Promise<Result<ConnectionState, NexaError>>;

  // —— Eventos (publica) ——
  // CONNECTION_ONLINE, CONNECTION_OFFLINE, CONNECTION_CAPTIVE_PORTAL

  // —— Eventos (escucha) ——
  // SESSION_LOST (para forzar probe inmediato)
}

type ConnectionState =
  | 'ONLINE'
  | 'CAPTIVE_PORTAL'
  | 'CONNECTING'        // transient state set by SessionManager
  | 'AUTHENTICATED'     // set by SessionManager
  | 'SESSION_EXPIRED'   // set by SessionManager
  | 'OFFLINE'
  | 'ERROR';
```

### 10.3 Estrategia de probe (F2-D12)

```
Heartbeat alarm cada 60s (chrome.alarms 'nexa.heartbeat'):

  Step 1: Probe A — fetch http://connectivitycheck.gstatic.com/generate_204
          - Si 204 → ONLINE
          - Si redirect/cualquier otra cosa → paso 2
          - Si network error → paso 3

  Step 2: Probe B — fetch https://secure.etecsa.net:8443/
          - Si 200 con HTML conteniendo 'formulario' → CAPTIVE_PORTAL
          - Si 200 sin form → ONLINE (raro, pero posible)
          - Si network error → paso 3

  Step 3: Probe C — fetch http://1.1.1.1/cdn-cgi/trace
          - Si responde → ONLINE pero ETECSA caído → marcar como ERROR
          - Si no responde → OFFLINE
```

### 10.4 Alarma de heartbeat

```typescript
// En chrome.runtime.onInstalled y onStartup
chrome.alarms.create('nexa.heartbeat', { periodInMinutes: 1 });
```

> `periodInMinutes: 1` es el mínimo en producción. Para desarrollo unpacked, 0.5 (30s) es posible.

### 10.5 Reactividad a eventos

```typescript
// Cuando SessionManager publica SESSION_LOST
connectionMonitor.onSessionLost.subscribe(async () => {
  // Forzar probe inmediato (no esperar al próximo heartbeat)
  await this.probe();
});
```

### 10.6 Anti-responsabilidades

- No hace login ni logout — eso es `SessionManager`.
- No decide si auto-reconectar — eso es `SessionManager` con la política de la cuenta.
- No muestra UI — eso es `NotificationEngine` + UI.

---

## 11. Inicialización del SW

### 11.1 Secuencia de bootstrap

```typescript
// src/app/background/service-worker.ts (conceptual)

async function bootstrap(): Promise<void> {
  // 1. Instanciar módulos transversales
  const eventBus = new EventBus();
  const messageBus = new MessageBus();

  // 2. Instanciar storage (sin deps)
  const storage = new StorageEngine();

  // 3. Migraciones de storage
  await storage.migrateAll();

  // 4. Instanciar servicios (orden importa por DI)
  const diagnostics = new DiagnosticEngine({ storage, eventBus });
  const crypto = new CryptoService({ storage, diagnostics, eventBus });
  const theme = new ThemeService({ storage });
  const connection = new ConnectionMonitor({ storage, diagnostics, eventBus });

  // 5. Servicios que dependen de crypto
  const accountManager = new AccountManager({ storage, crypto, /* ... */ });
  const notification = new NotificationEngine({ storage, diagnostics, eventBus });

  // 6. Connector (con offscreen bridge)
  const connector = new EtecsaConnector({ diagnostics, /* ... */ });

  // 7. SessionManager y SchedulerEngine (deps de servicios previos)
  const session = new SessionManager({ connector, accountManager, /* ... */ });
  const scheduler = new SchedulerEngine({ storage, session, /* ... */ });

  // 8. Registrar handlers del message bus
  messageBus.register('SESSION_LOGIN', session.handleLogin);
  messageBus.register('ACCOUNT_CREATE', accountManager.handleCreate);
  // ...

  // 9. Registrar alarm handlers
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'nexa.heartbeat') {
      await connection.probe();
    } else if (alarm.name.startsWith('nexa.scheduler.')) {
      await scheduler.handleAlarm(alarm.name);
    } else if (alarm.name.startsWith('nexa.reconnect.')) {
      await session.handleReconnectAlarm(alarm.name);
    }
  });

  // 10. Registrar storage change listener para EventBus
  chrome.storage.onChanged.addListener((changes, area) => {
    // Notificar a stores de UI (es automático via storage events)
    // Loggear cambios significativos
    diagnostics.debug('storage', 'Cambio detectado', { area, keys: Object.keys(changes) });
  });

  // 11. Heartbeat alarm
  chrome.alarms.create('nexa.heartbeat', { periodInMinutes: 1 });

  diagnostics.info('system', 'Service Worker inicializado', { version: '1.0.0' });
}

chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(bootstrap);
```

### 11.2 Sobrevivir a reinicio del SW

El SW puede morir en cualquier momento. Al revivir (por un evento), el bootstrap se ejecuta de nuevo.

- **Estado en memoria**: se pierde. Aceptable porque todo está en storage.
- **Handlers registrados**: se re-registran en cada bootstrap.
- **Alarms**: Chrome las mantiene aunque el SW muera. Al revivir, los handlers están listos.
- **Operaciones en progreso**: si el SW muere a mitad de un login, la operación se cancela. La UI muestra error tras timeout. El usuario puede reintentar.

---

## 12. Anti-patrones de servicios

| Antipatrón | Por qué está mal |
|------------|------------------|
| Mantener `Map<>` o `Set<>` en memoria del servicio | Se pierde al morir el SW. Usar storage. |
| Hacer `fetch` directo desde un servicio | El fetch a ETECSA es exclusivo del connector. Otros fetches (probes) van en `ConnectionMonitor`. |
| Llamar a `chrome.storage` directamente | Usar `StorageEngine`. |
| Lanzar excepciones | Retornar `Result`. |
| Importar React | Los servicios son SW-side; no conocen React. |
| Llamar a servicios en constructor (DI estricto) | Pasar deps via constructor; no usar service locators. |
| Singleton literal con estado | Stateless singleton lógico — recréalo libremente. |
| Logs con datos sensibles | Sanitizar siempre (F2-D18). |

---

## 13. Pendientes para Fase 4

- Definir schemas Zod exactos para cada entidad (`Account`, `SessionData`, `Balance`, `SchedulerTask`, `Settings`, `LogEntry`, `BackupPackage`).
- Definir migrations iniciales (v1) por cada namespace.
- Definir el formato exacto de `BackupPackage`.
- Definir el catálogo completo de `NexaError` codes por categoría.

---

**Fin del Documento 3.**
Continúa en `04-data-flow-documentation.md`.
