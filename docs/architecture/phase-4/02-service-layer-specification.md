# NEXA NautaX — Service Layer Specification

**Fase:** 4
**Documento:** 2 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Especificación detallada de los 9 servicios: interfaces, métodos, eventos, dependencias, política de decisiones. Refinamiento del Doc 3 de Fase 2 con tipos concretos del Doc 1.

---

## 1. Visión General

### 1.1 Principios

1. **Stateless** — ningún servicio mantiene estado en memoria del SW.
2. **Result<T,E>** — ningún servicio lanza excepciones; siempre devuelve `Result`.
3. **DI estricto** — dependencias via constructor, no service locator.
4. **Event-driven** — servicios publican eventos al `EventBus` y se suscriben a eventos de otros.
5. **Idempotencia** — toda operación puede repetirse tras reinicio del SW.

### 1.2 Mapa de servicios

| Servicio | Responsabilidad principal |
|----------|---------------------------|
| `SessionManager` | Ciclo de vida de sesión ETECSA |
| `AccountManager` | CRUD de cuentas |
| `SchedulerEngine` | Tareas programadas |
| `NotificationEngine` | Toasts NEXA custom + icon states |
| `StorageEngine` | Abstracción sobre chrome.storage |
| `DiagnosticEngine` | Logging + health reports |
| `CryptoService` | PBKDF2, AES-GCM |
| `ThemeService` | Aplicación de temas |
| `ConnectionMonitor` | Detección de estado de red |

---

## 2. SessionManager

### 2.1 Responsabilidad

Único punto de control del ciclo de vida de la sesión ETECSA. Orquesta `EtecsaConnector`, `AccountManager`, `StorageEngine`, `CryptoService`, `SchedulerEngine`, `NotificationEngine`, `ConnectionMonitor`.

### 2.2 Interfaz

```typescript
interface ISessionManager {
  // —— Ciclo de vida ——
  login(accountId: AccountId): Promise<Result<SessionData, NexaError>>;
  logout(): Promise<Result<void, NexaError>>;
  logoutLocal(reason: SessionEndReason): Promise<Result<void, NexaError>>;
  reconnect(): Promise<Result<SessionData, NexaError>>;
  refresh(): Promise<Result<SessionStatus, NexaError>>;

  // —— Consultas ——
  getActiveSession(): Promise<SessionData | null>;
  getStatus(): Promise<SessionStatusKind>;
  getTimeRemaining(): Promise<Result<Duration, NexaError>>;
  getBalance(): Promise<Result<Balance, NexaError>>;
  getSessionInfo(): Promise<Result<SessionInfo, NexaError>>;

  // —— Handlers (llamados por MessageBus o EventBus) ——
  handleLogin(message: SessionLoginMessage): Promise<ExtensionResponse<SessionData>>;
  handleLogout(message: SessionLogoutMessage): Promise<ExtensionResponse<void>>;
  handleReconnect(message: SessionReconnectMessage): Promise<ExtensionResponse<SessionData>>;
  handleRefresh(message: SessionRefreshMessage): Promise<ExtensionResponse<SessionStatus>>;
  handleSessionLost(event: SessionLostEvent): Promise<void>;
  handleReconnectAlarm(alarmName: string): Promise<void>;
}

type SessionStatusKind =
  | 'offline'
  | 'captive_portal'
  | 'connecting'
  | 'authenticated'
  | 'session_expired'
  | 'error';

interface SessionStatus {
  readonly kind: SessionStatusKind;
  readonly session: SessionData | null;
  readonly durationMs: number | null;
  readonly timeRemaining: Duration | null;
  readonly balance: Balance | null;
  readonly lastError: NexaError | null;
}

interface SessionInfo {
  readonly session: SessionData;
  readonly timeRemaining?: Duration;
  readonly balance?: Balance;
}
```

### 2.3 Dependencias

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

### 2.4 Métodos detallados

#### `login(accountId)`

```
PRECONDITIONS:
  - crypto.isLocked() === false  → else CRYPTO_LOCKED
  - connection.state === 'CAPTIVE_PORTAL' | 'SESSION_EXPIRED' → else NETWORK_OFFLINE
  - getActiveSession() === null  → else SESSION_ALREADY_ACTIVE
  - account = accountManager.getById(accountId) !== null  → else VALIDATION_FAILED

FLOW:
  1. diagnostics.info('session', 'Login iniciado', { accountId, traceId })
  2. account = await accountManager.getById(accountId)
  3. plaintextPassword = await crypto.decrypt(account.encryptedPassword)
     - si crypto locked → return CRYPTO_LOCKED
  4. publish status='connecting'
  5. result = await connector.login({
       username: account.username,
       password: plaintextPassword,
       accountType: 'prepaid',
     })
  6. clear plaintextPassword de memoria
  7. if !result.ok →
     - publish status='error'
     - notification.error(result.error.userMessage, result.error.recommendedAction)
     - return result.error
  8. session = result.value.session
  9. await storage.sessions.setActive(session)
  10. await storage.history.startRecord(session)
  11. accountManager.markUsed(accountId)
  12. publish SESSION_STARTED event
  13. publish status='authenticated'
  14. notification.updateActionIcon('connected')
  15. if settings.notifications.onReconnect (and was reconnect):
      notification.success('Sesión iniciada')
  16. diagnostics.info('session', 'Login completado', { accountId, durationMs, traceId })
  17. return Ok(session)

EDGE CASES:
  - SW muere entre step 5 y 9: la sesión se estableció en ETECSA pero no en storage.
    En próxima apertura, ConnectionMonitor detecta CAPTIVE_PORTAL→AUTHENTICATED transition,
    pero no tenemos SessionData. Ofrecer al usuario "recuperar sesión" (probe de attributeUuid
    via strategy chain) o "logout forzado".
```

#### `logout()`

```
PRECONDITIONS:
  - getActiveSession() !== null → else SESSION_NOT_FOUND

FLOW:
  1. session = await getActiveSession()
  2. diagnostics.info('session', 'Logout iniciado', { accountId: session.accountId, traceId })
  3. result = await connector.logout(session)
  4. if !result.ok:
     - if result.error.code === 'SESSION_NOT_FOUND' → treat as success (already closed)
     - else:
       - notification.error(result.error.userMessage)
       - ask user: "¿Cerrar localmente de todos modos?" → if yes, logoutLocal('error')
       - return result.error
  5. await logoutLocal('manual')
  6. return Ok(void)

EDGE CASES:
  - SW muere durante logout HTTP: sesión ETECSA puede quedar abierta.
    En próxima apertura, ConnectionMonitor detecta AUTHENTICATED state.
    UI pregunta: "Hay sesión activa en ETECSA. ¿Cerrarla?"
```

#### `logoutLocal(reason)`

```
FLOW:
  1. session = await getActiveSession()
  2. if !session → return Ok(void)
  3. await storage.history.endRecord(session.id, reason)
  4. await storage.sessions.clearActive()
  5. scheduler.cancelSessionTasks()
  6. publish SESSION_LOST event with { reason }
  7. notification.updateActionIcon('disconnected')
  8. diagnostics.info('session', 'Logout local completado', { reason })
```

#### `reconnect()`

```
PRECONDITIONS:
  - account = last active account has reconnectPolicy.enabled === true
  - connection.state === 'CAPTIVE_PORTAL' | 'SESSION_EXPIRED'

FLOW:
  1. account = await accountManager.getLastActive()
  2. if !account → return error
  3. if !account.reconnectPolicy.enabled → return error
  4. return await login(account.id)
```

#### `handleSessionLost(event)`

```
POLICY (D03):
  - if reason === 'manual' → no auto-reconnect
  - if reason === 'balance_zero' and account.reconnectPolicy.onZeroBalance === 'stop' → no reconnect
  - else if account.reconnectPolicy.enabled === true → start reconnect loop
  - else → notify user "Sesión perdida"

RECONNECT LOOP:
  for attempt = 1 to maxRetries:
    delay = computeBackoff(attempt, policy)
    await sleep(delay)
    
    state = await connection.probe()
    if state not in ['CAPTIVE_PORTAL', 'SESSION_EXPIRED']:
      continue  // no point trying
    
    result = await reconnect()
    if result.ok:
      publish SESSION_REFRESHED
      if policy.notifyOnReconnect:
        notification.success('Reconectado', `Intento ${attempt}`)
      return
    
  // all attempts failed
  notification.error('No se pudo reconectar',
    `Tras ${maxRetries} intentos. Verifica tu conexión.`)
  publish SESSION_LOST final
```

#### `getActiveSession()`

```
FLOW:
  return await storage.sessions.getActive()
```

#### `getStatus()`

```
FLOW:
  session = await getActiveSession()
  if !session:
    state = await connection.getCurrentState()
    return mapConnectionStateToSessionStatus(state)
  
  // session exists
  durationMs = Date.now() - session.startedAt
  return {
    kind: 'authenticated',
    session,
    durationMs,
    timeRemaining: null,  // requires connector call, separate method
    balance: null,        // requires connector call
    lastError: null,
  }
```

#### `refresh()`

```
FLOW:
  1. session = await getActiveSession()
  2. if !session → return SESSION_NOT_FOUND
  3. result = await connector.getSessionInfo(session)
  4. if !result.ok → return result.error
  5. if result.value.balance:
     await storage.balances.set(session.accountId, result.value.balance)
     publish BALANCE_UPDATED
     if result.value.balance.amount < settings.notifications.lowBalanceThreshold:
       publish BALANCE_LOW
  6. session.lastSync = now
  7. await storage.sessions.updateActive(session)
  8. publish SESSION_REFRESHED
  9. return Ok({ session, timeRemaining, balance })
```

### 2.5 Eventos publicados

| Evento | Cuándo | Payload |
|--------|--------|---------|
| `SESSION_STARTED` | Tras login exitoso | `{ session, at }` |
| `SESSION_LOST` | Tras logout o pérdida | `{ reason, at }` |
| `SESSION_EXPIRED` | ETECSA cerró sesión | `{ at }` |
| `SESSION_REFRESHED` | Tras refresh exitoso | `{ session, at }` |
| `BALANCE_UPDATED` | Tras obtener nuevo balance | `{ balance, at }` |
| `BALANCE_LOW` | Balance < threshold | `{ amount, threshold, at }` |

### 2.6 Eventos escuchados

| Evento | Acción |
|--------|--------|
| `CONNECTION_OFFLINE` | Pausar reconnect loop |
| `CONNECTION_CAPTIVE_PORTAL` | Si hay sesión activa → publicar SESSION_LOST con `reason='connection_lost'` |
| `CONNECTION_ONLINE` | Reanudar reconnect loop si estaba pausado |

---

## 3. AccountManager

### 3.1 Responsabilidad

CRUD de cuentas Nauta. Cifra credenciales antes de persistir. Valida estructura con Zod. Expone selección de cuenta activa.

### 3.2 Interfaz

```typescript
interface IAccountManager {
  // —— CRUD ——
  create(input: NewAccountInput): Promise<Result<Account, NexaError>>;
  update(accountId: AccountId, input: AccountUpdateInput): Promise<Result<Account, NexaError>>;
  delete(accountId: AccountId): Promise<Result<void, NexaError>>;
  list(): Promise<readonly Account[]>;
  getById(accountId: AccountId): Promise<Account | null>;
  getByUsername(username: string): Promise<Account | null>;

  // —— Selección ——
  select(accountId: AccountId): Promise<Result<void, NexaError>>;
  getSelected(): Promise<Account | null>;
  getLastActive(): Promise<Account | null>;  // última cuenta con sesión

  // —— Marcas internas ——
  markUsed(accountId: AccountId): Promise<void>;

  // —— Validación ——
  verifyCredentials(accountId: AccountId): Promise<Result<CredentialsVerification, NexaError>>;

  // —— Reconnect policy ——
  updateReconnectPolicy(accountId: AccountId, policy: Partial<ReconnectPolicy>): Promise<Result<void, NexaError>>;

  // —— Handlers ——
  handleCreate(message: AccountCreateMessage): Promise<ExtensionResponse<Account>>;
  handleUpdate(message: AccountUpdateMessage): Promise<ExtensionResponse<Account>>;
  handleDelete(message: AccountDeleteMessage): Promise<ExtensionResponse<void>>;
  handleSelect(message: AccountSelectMessage): Promise<ExtensionResponse<void>>;
  handleVerifyCredentials(message: AccountVerifyMessage): Promise<ExtensionResponse<CredentialsVerification>>;
}

interface CredentialsVerification {
  readonly valid: boolean;
  readonly balance?: Balance;
  readonly error?: NexaError;
}
```

### 3.3 Dependencias

```typescript
interface AccountManagerDeps {
  readonly storage: IStorageEngine;
  readonly crypto: ICryptoService;
  readonly connector: IEtecsaConnector;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
  readonly session: ISessionManager;  // for delete (logout if active)
}
```

### 3.4 Métodos detallados

#### `create(input)`

```
PRECONDITIONS:
  - crypto.isLocked() === false
  - input passes Zod newAccountSchema
  - username doesn't already exist (case insensitive)

FLOW:
  1. validate input → if invalid, return VALIDATION_FAILED with details
  2. normalize username (lowercase, add @nauta.com.cu if no @)
  3. existing = await getByUsername(input.username)
     if existing → return VALIDATION_FAILED "Ya existe una cuenta con este usuario"
  4. encryptedPassword = await crypto.encrypt(input.password)
  5. account: Account = {
       id: generateAccountId(),
       alias: input.alias,
       username: normalized,
       encryptedPassword,
       type: input.type,
       reconnectPolicy: { ...DEFAULT_RECONNECT_POLICY, ...input.reconnectPolicy },
       createdAt: now,
       updatedAt: now,
       lastUsed: null,
       isSelected: false,
     }
  6. await storage.accounts.save(account)
  7. publish ACCOUNT_CREATED
  8. return Ok(account)
```

#### `update(accountId, input)`

```
FLOW:
  1. account = await getById(accountId)
     if !account → return VALIDATION_FAILED "Cuenta no encontrada"
  2. validate input with accountUpdateSchema
  3. updated: Account = { ...account }
     if input.alias → updated.alias = input.alias
     if input.username → updated.username = normalize(input.username)
     if input.password →
       plaintextNew = input.password
       updated.encryptedPassword = await crypto.encrypt(plaintextNew)
       clear plaintextNew
     if input.type → updated.type = input.type
     if input.reconnectPolicy →
       updated.reconnectPolicy = { ...account.reconnectPolicy, ...input.reconnectPolicy }
     updated.updatedAt = now
  4. await storage.accounts.save(updated)
  5. publish ACCOUNT_UPDATED
  6. return Ok(updated)
```

#### `delete(accountId)`

```
PRECONDITIONS:
  - account exists

FLOW:
  1. account = await getById(accountId)
     if !account → return VALIDATION_FAILED
  2. session = await session.getActiveSession()
     if session?.accountId === accountId:
       // cerrar sesión primero
       await session.logout()
  3. await storage.accounts.delete(accountId)
  4. await storage.scheduler.deleteByAccount(accountId)  // cancelar tareas
  5. await storage.history.anonymizeByAccount(accountId)  // mantener historial anónimo
  6. publish ACCOUNT_DELETED
  7. return Ok(void)
```

#### `verifyCredentials(accountId)`

```
FLOW:
  1. account = await getById(accountId)
  2. plaintextPassword = await crypto.decrypt(account.encryptedPassword)
  3. result = await connector.verifyCredentials({
       username: account.username,
       password: plaintextPassword,
       accountType: 'prepaid',
     })
  4. clear plaintextPassword
  5. if result.ok:
     // result.value tiene balance si credentials son válidas
     return Ok({ valid: true, balance: result.value.balance })
  6. else:
     if result.error.code === 'AUTH_INVALID_CREDENTIALS':
       return Ok({ valid: false, error: result.error })
     else:
       // network error etc — credentials unknown
       return result.error
```

### 3.5 Eventos publicados

| Evento | Cuándo |
|--------|--------|
| `ACCOUNT_CREATED` | Tras create exitoso |
| `ACCOUNT_UPDATED` | Tras update exitoso |
| `ACCOUNT_DELETED` | Tras delete exitoso |
| `ACCOUNT_SELECTED` | Tras select exitoso |

---

## 4. SchedulerEngine

### 4.1 Responsabilidad

Programa y ejecuta tareas diferidas. Usa `chrome.alarms`. Tipos: logout temporizado, logout a hora específica, tiempo máximo de sesión.

### 4.2 Interfaz

```typescript
interface ISchedulerEngine {
  // —— Tareas ——
  createTask(input: NewSchedulerTaskInput): Promise<Result<SchedulerTask, NexaError>>;
  cancelTask(taskId: SchedulerTaskId): Promise<Result<void, NexaError>>;
  listTasks(): Promise<readonly SchedulerTask[]>;
  getTask(taskId: SchedulerTaskId): Promise<SchedulerTask | null>;
  listActiveTasks(): Promise<readonly SchedulerTask[]>;

  // —— Ejecución ——
  handleAlarm(alarmName: string): Promise<void>;

  // —— Lifecycle ——
  restorePendingTasks(): Promise<void>;  // llamado en SW startup

  // —— Handlers ——
  handleCreateTask(message: SchedulerCreateMessage): Promise<ExtensionResponse<SchedulerTask>>;
  handleCancelTask(message: SchedulerCancelMessage): Promise<ExtensionResponse<void>>;
  handleListTasks(message: SchedulerListMessage): Promise<ExtensionResponse<readonly SchedulerTask[]>>;
}

interface NewSchedulerTaskInput {
  readonly type: SchedulerTaskType;
  readonly trigger: SchedulerTrigger;
  readonly enabled: boolean;
  readonly accountId: AccountId | null;
  readonly recurring: boolean;
  readonly notifyOnExecute: boolean;
}
```

### 4.3 Dependencias

```typescript
interface SchedulerEngineDeps {
  readonly storage: IStorageEngine;
  readonly session: ISessionManager;
  readonly notification: INotificationEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

### 4.4 Métodos detallados

#### `createTask(input)`

```
FLOW:
  1. validate input
  2. taskId = generateSchedulerTaskId()
  3. nextRunAt = computeNextRun(input.trigger)
  4. task: SchedulerTask = {
       id: taskId,
       type: input.type,
       trigger: input.trigger,
       enabled: input.enabled,
       accountId: input.accountId,
       createdAt: now,
       nextRunAt,
       lastExecutedAt: null,
       status: 'pending',
       lastError: null,
       recurring: input.recurring,
     }
  5. await storage.scheduler.save(task)
  6. alarmName = `nexa.scheduler.${taskId}`
     chrome.alarms.create(alarmName, toAlarmInfo(input.trigger, nextRunAt))
  7. return Ok(task)
```

#### `handleAlarm(alarmName)`

```
FLOW:
  1. parse taskId from alarmName (must start with 'nexa.scheduler.')
  2. task = await getTask(taskId)
     if !task → return  // orphan alarm
  3. if !task.enabled → mark 'cancelled', return
  4. mark task.status = 'executing'
     await storage.scheduler.save(task)
  5. publish SCHEDULER_TASK_FIRED
  6. session = await session.getActiveSession()
     if !session:
       // no session to logout
       task.status = 'completed'
       task.lastError = { code: 'SESSION_NOT_FOUND', ... }
       await storage.scheduler.save(task)
       publish SCHEDULER_TASK_COMPLETED { success: false }
       return
  7. result = await session.logout()
  8. if result.ok:
       task.status = 'completed'
       task.lastError = null
     else:
       task.status = 'failed'
       task.lastError = result.error
  9. task.lastExecutedAt = now
  10. if task.recurring:
        task.nextRunAt = computeNextRun(task.trigger)
        task.status = 'pending'
        chrome.alarms.create(alarmName, ...)
     else:
        task.nextRunAt = null
  11. await storage.scheduler.save(task)
  12. publish SCHEDULER_TASK_COMPLETED { success: result.ok, taskId }
  13. if task.notifyOnExecute and result.ok:
        notification.info('Desconexión completada')
```

#### `restorePendingTasks()`

```
Llamado en SW startup (onStartup o onInstalled).

FLOW:
  1. tasks = await listTasks()
  2. for each task where status === 'pending' or 'executing':
     - if task.nextRunAt and task.nextRunAt < now:
       // missed while SW was dead — execute now or skip?
       if task.recurring:
         task.nextRunAt = computeNextRun(task.trigger)
       else:
         // missed one-shot — mark as failed (user wasn't around)
         task.status = 'failed'
         task.lastError = { code: 'SCHEDULER_TASK_NOT_FOUND', message: 'Missed' }
     - chrome.alarms.create(`nexa.scheduler.${task.id}`, toAlarmInfo(task.trigger, task.nextRunAt))
  3. await storage.scheduler.saveAll(updated tasks)
```

### 4.5 Eventos publicados

| Evento | Cuándo |
|--------|--------|
| `SCHEDULER_TASK_FIRED` | Al dispararse una tarea |
| `SCHEDULER_TASK_COMPLETED` | Tras ejecución (success o fail) |

### 4.6 Eventos escuchados

| Evento | Acción |
|--------|--------|
| `SESSION_STARTED` | Si hay tareas `MAX_SESSION_TIME`, crear alarm |
| `SESSION_LOST` (any reason) | Cancelar tareas `LOGOUT_TIMER` y `LOGOUT_TIME` huérfanas |

---

## 5. NotificationEngine

### 5.1 Responsabilidad

Mostrar notificaciones al usuario via Toast System NEXA custom. No usa `chrome.notifications` nativas. Expone badges y cambios de icono de la extensión.

### 5.2 Interfaz

```typescript
interface INotificationEngine {
  // —— API directa ——
  success(title: string, message?: string, action?: NotificationAction): Promise<NotificationId>;
  error(title: string, message?: string, action?: NotificationAction): Promise<NotificationId>;
  warning(title: string, message?: string, action?: NotificationAction): Promise<NotificationId>;
  info(title: string, message?: string, action?: NotificationAction): Promise<NotificationId>;
  custom(input: NotificationInput): Promise<NotificationId>;

  // —— Gestión ——
  dismiss(notificationId: NotificationId): Promise<void>;
  dismissAll(): Promise<void>;
  listActive(): Promise<readonly Notification[]>;
  clearDismissed(): Promise<void>;

  // —— Badges e iconos ——
  updateActionIcon(state: ActionIconState): Promise<void>;
  setBadge(text: string | null, color?: string): Promise<void>;
  clearBadge(): Promise<void>;

  // —— Handlers (event-driven) ——
  handleSessionLost(event: SessionLostEvent): Promise<void>;
  handleSessionStarted(event: SessionStartedEvent): Promise<void>;
  handleSessionRefreshed(event: SessionRefreshedEvent): Promise<void>;
  handleBalanceLow(event: BalanceLowEvent): Promise<void>;
  handleConnectorDegraded(event: ConnectorDegradedEvent): Promise<void>;
  handleSchedulerTaskCompleted(event: SchedulerTaskCompletedEvent): Promise<void>;
}

type ActionIconState = 'connected' | 'reconnecting' | 'disconnected' | 'no-account' | 'error';

interface NotificationAction {
  readonly label: string;
  readonly type: 'open_sidepanel' | 'open_popup' | 'dismiss' | 'custom';
  readonly payload?: unknown;
}
```

### 5.3 Dependencias

```typescript
interface NotificationEngineDeps {
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
  readonly settings: ISettingsRepository;  // para checks de settings.notifications.*
}
```

### 5.4 Métodos detallados

#### `custom(input)`

```
FLOW:
  1. check settings.notifications.enabled
     if false → return silently (no notification)
  2. id = generateNotificationId()
  3. notification: Notification = {
       id,
       variant: input.variant,
       title: input.title,
       message: input.message,
       action: input.action,
       createdAt: now,
       durationMs: input.durationMs ?? defaultByVariant(input.variant),
       persistent: input.persistent ?? (input.variant === 'error'),
       dismissed: false,
       source: input.source ?? 'system',
     }
  4. await storage.notifications.add(notification)
     // this triggers storage.onChanged → UI shows toast
  5. if !notification.persistent and notification.durationMs > 0:
     chrome.alarms.create(`nexa.notification.${id}`, { delayInMinutes: notification.durationMs / 60000 })
  6. return id
```

#### `dismiss(notificationId)`

```
FLOW:
  1. await storage.notifications.markDismissed(notificationId)
  2. chrome.alarms.clear(`nexa.notification.${notificationId}`)
  3. // UI will auto-update via storage.onChanged
```

#### `handleSessionLost(event)`

```
FLOW:
  if !settings.notifications.onDisconnect → return
  if event.reason === 'manual' → return  // silent
  
  if event.reason === 'balance_zero':
    error('Saldo agotado', 'La cuenta no tiene saldo suficiente.')
  else if event.reason === 'session_expired':
    warning('Sesión expirada', 'ETECSA cerró la sesión.')
  else if event.reason === 'connection_lost':
    warning('Conexión perdida', 'Intentando reconectar...')
  else:
    info('Sesión finalizada', `Motivo: ${event.reason}`)
```

#### `updateActionIcon(state)`

```
FLOW:
  path = {
    '16': `public/icons/icon-states/${state}-16.png`,
    '32': `public/icons/icon-states/${state}-32.png`,
    '48': `public/icons/icon-states/${state}-48.png`,
    '128': `public/icons/icon-states/${state}-128.png`,
  }
  await chrome.action.setIcon({ path })
```

#### `setBadge(text, color)`

```
FLOW:
  await chrome.action.setBadgeText({ text: text ?? '' })
  await chrome.action.setBadgeBackgroundColor({ color: color ?? '#ef4444' })
```

### 5.5 Reglas especiales

- Si `notifications.enabled === false` globalmente → no se muestran toasts, pero `updateActionIcon` y `setBadge` siguen funcionando.
- Errores FATALES siempre se muestran sin importar settings.
- Cuando el popup está abierto, los toasts se muestran ahí. Cuando está cerrado, solo badge + icon state.

---

## 6. StorageEngine

### 6.1 Responsabilidad

Abstracción tipada sobre `chrome.storage.local`. Centraliza acceso. Delega a repositories para operaciones por entidad. Maneja migrations.

### 6.2 Interfaz

```typescript
interface IStorageEngine {
  // —— Primitivas ——
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;

  // —— Namespaces ——
  getNamespace<T>(namespace: string): Promise<Readonly<Record<string, T>>>;
  clearNamespace(namespace: string): Promise<void>;

  // —— Migrations ——
  getVersion(namespace: string): Promise<number>;
  setVersion(namespace: string, version: number): Promise<void>;
  migrateAll(): Promise<Result<void, NexaError>>;

  // —— Repositories (lazy getters) ——
  readonly accounts: IAccountRepository;
  readonly sessions: ISessionRepository;
  readonly history: IHistoryRepository;
  readonly settings: ISettingsRepository;
  readonly scheduler: ISchedulerRepository;
  readonly logs: ILogRepository;
  readonly network: INetworkRepository;
  readonly notifications: INotificationRepository;
  readonly meta: IMetaRepository;
  readonly crypto: ICryptoRepository;

  // —— Backup ——
  exportAll(): Promise<BackupPackage>;
  importAll(package_: BackupPackage): Promise<Result<void, NexaError>>;

  // —— Events ——
  onChanged(key: string, handler: (newValue: unknown, oldValue: unknown) => void): () => void;
}
```

### 6.3 Detalle en Documento 3

La estructura completa de namespaces, repositories y migrations está en el **Documento 3 — Storage Architecture**.

---

## 7. DiagnosticEngine

### 7.1 Responsabilidad

Logger central. Sanitiza antes de persistir. Expone consultas para Developer Mode.

### 7.2 Interfaz

```typescript
interface IDiagnosticEngine {
  // —— Logging ——
  log(level: LogLevel, category: LogCategory, message: string, details?: unknown): Promise<void>;
  debug(category: LogCategory, message: string, details?: unknown): Promise<void>;
  info(category: LogCategory, message: string, details?: unknown): Promise<void>;
  warn(category: LogCategory, message: string, details?: unknown): Promise<void>;
  error(category: LogCategory, message: string, details?: unknown): Promise<void>;
  fatal(category: LogCategory, message: string, details?: unknown): Promise<void>;

  // —— Trace ——
  startTrace(category: LogCategory, operation: string): TraceContext;

  // —— Consultas ——
  getLogs(filter?: LogFilter): Promise<readonly DiagnosticLog[]>;
  getLogsByCategory(category: LogCategory, limit?: number): Promise<readonly DiagnosticLog[]>;
  getLogsByLevel(level: LogLevel, limit?: number): Promise<readonly DiagnosticLog[]>;
  getLogsByTrace(traceId: TraceId): Promise<readonly DiagnosticLog[]>;
  getConnectorHealth(): ConnectorHealth;
  getNetworkHistory(limit?: number): Promise<readonly NetworkRecord[]>;

  // —— Health reporting ——
  reportConnectorSuccess(operation: string, strategy: StrategyName, timing: HttpTiming): void;
  reportConnectorFailure(operation: string, strategy: StrategyName, error: NexaError): void;
  reportConnectorFallback(operation: string, from: StrategyName, to: StrategyName): void;
  reportNetworkRecord(record: NetworkRecord): Promise<void>;

  // —— Gestión ——
  clear(): Promise<void>;
  clearBefore(timestamp: number): Promise<void>;
  export(): Promise<ExportedLogs>;

  // —— Handlers (event-driven) ——
  // Se suscribe a TODOS los eventos del EventBus y los loggea
}

interface TraceContext {
  readonly traceId: TraceId;
  readonly startedAt: number;
  log(level: LogLevel, message: string, details?: unknown): Promise<void>;
  end(): Promise<void>;  // logs elapsed time
}

interface LogFilter {
  readonly level?: LogLevel | readonly LogLevel[];
  readonly category?: LogCategory | readonly LogCategory[];
  readonly since?: number;
  readonly until?: number;
  readonly traceId?: TraceId;
  readonly search?: string;
  readonly limit?: number;
}

interface ExportedLogs {
  readonly exportedAt: number;
  readonly extensionVersion: string;
  readonly logs: readonly DiagnosticLog[];
  readonly networkRecords: readonly NetworkRecord[];
  readonly connectorHealth: ConnectorHealth;
}
```

### 7.3 Dependencias

```typescript
interface DiagnosticEngineDeps {
  readonly storage: IStorageEngine;
  readonly eventBus: IEventBus;
  readonly sanitizer: (input: string) => string;
}
```

### 7.4 Métodos detallados

#### `log(level, category, message, details)`

```
FLOW:
  1. check settings.developer.logLevel
     if level below threshold → return silently (DEBUG if threshold is DEBUG, etc.)
  2. sanitizedMessage = sanitizer(message)
  3. sanitizedDetails = details ? sanitizeObject(details) : undefined
  4. logEntry: DiagnosticLog = {
       id: generateLogId(),
       timestamp: now,
       level,
       category,
       message: sanitizedMessage,
       details: sanitizedDetails,
       traceId: currentTrace?.traceId,
     }
  5. await storage.logs.add(logEntry)
     // FIFO: if > 5000, remove oldest
  6. if level === 'FATAL':
     publish FATAL event for NotificationEngine
```

#### `startTrace(category, operation)`

```
FLOW:
  1. traceId = generateTraceId()
  2. await info(category, `${operation} iniciado`, { traceId })
  3. return TraceContext {
       traceId,
       startedAt: now,
       log: (level, msg, details) => log(level, category, msg, { ...details, traceId }),
       end: () => info(category, `${operation} completado`, { traceId, durationMs: now - startedAt }),
     }
```

#### `reportConnectorSuccess(operation, strategy, timing)`

```
FLOW:
  1. health.lastOperation = operation
  2. health.lastSuccessAt = now
  3. health.currentStrategy = strategy
  4. health.consecutiveFailures = 0
  5. health.totalOperations += 1
  6. health.totalSuccesses += 1
  7. publish CONNECTOR_OPERATION_SUCCESS { operation, strategy, timing, at }
```

#### `reportConnectorFailure(operation, strategy, error)`

```
FLOW:
  1. health.lastOperation = operation
  2. health.lastError = error
  3. health.consecutiveFailures += 1
  4. health.totalOperations += 1
  5. health.totalFailures += 1
  6. publish CONNECTOR_OPERATION_FAILURE { operation, strategy, error, at }
  7. if health.consecutiveFailures >= 3:
     publish CONNECTOR_DEGRADED { reason: '3 consecutive failures' }
```

### 7.5 Anti-responsabilidades

- No sanitiza logs que ya están sanitizados (idempotente).
- No decide qué hacer con los logs (eso es UI).
- No expone datos sensibles (siempre sanitizados).

---

## 8. CryptoService

### 8.1 Responsabilidad

Único punto de operaciones criptográficas. Cifra/descifra credenciales. Deriva llaves de master password. Gestiona lock/unlock.

### 8.2 Interfaz

```typescript
interface ICryptoService {
  // —— Setup ——
  isInitialized(): Promise<boolean>;
  createMasterPassword(masterPassword: string): Promise<Result<void, NexaError>>;

  // —— Unlock / Lock ——
  isLocked(): Promise<boolean>;
  unlock(masterPassword: string): Promise<Result<void, NexaError>>;
  lock(): Promise<void>;
  changeMasterPassword(old: string, new_: string): Promise<Result<void, NexaError>>;

  // —— Cifrado / Descifrado ——
  encrypt(plaintext: string): Promise<Result<string, NexaError>>;
  decrypt(ciphertext: string): Promise<Result<string, NexaError>>;

  // —— Utilidades ——
  generateSecureId(): string;
  generateSecureBytes(length: number): Uint8Array;
  constantTimeCompare(a: string, b: string): boolean;

  // —— Handlers ——
  handleUnlock(message: CryptoUnlockMessage): Promise<ExtensionResponse<void>>;
  handleLock(message: CryptoLockMessage): Promise<ExtensionResponse<void>>;
  handleCreateMaster(message: CryptoCreateMasterMessage): Promise<ExtensionResponse<void>>;
  handleChangeMaster(message: CryptoChangeMasterMessage): Promise<ExtensionResponse<void>>;
  handleGetState(message: CryptoGetStateMessage): Promise<ExtensionResponse<CryptoState>>;
}

interface CryptoState {
  readonly initialized: boolean;
  readonly locked: boolean;
  readonly createdAt: number | null;
  readonly kdfParams: { iterations: number; hash: string } | null;
}
```

### 8.3 Dependencias

```typescript
interface CryptoServiceDeps {
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

### 8.4 Métodos detallados

#### `createMasterPassword(masterPassword)`

```
PRECONDITIONS:
  - !isInitialized() (not already created)

FLOW:
  1. validate password strength (warn if weak, but don't block)
  2. salt = generateSecureBytes(16)
  3. aesKey = await deriveKey(masterPassword, salt, 250000, 'SHA-256')
  4. verifier = await encrypt('NEXA_VERIFIER_v1', aesKey)
  5. await storage.crypto.setVerifier({
       salt: base64(salt),
       verifier,
       kdfParams: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 250000 },
       schemaVersion: 1,
       createdAt: now,
     })
  6. await storage.session.set('nexa.crypto.aesKey', base64(rawKey))
  7. publish CRYPTO_UNLOCKED
  8. return Ok(void)
```

#### `unlock(masterPassword)`

```
PRECONDITIONS:
  - isInitialized() === true

FLOW:
  1. check rate limit (cooldown after 3 fails)
  2. cryptoVerifier = await storage.crypto.getVerifier()
  3. salt = base64decode(cryptoVerifier.salt)
  4. aesKey = await deriveKey(masterPassword, salt, iterations, hash)
  5. result = await decrypt(cryptoVerifier.verifier, aesKey)
  6. if result !== 'NEXA_VERIFIER_v1':
     - increment fail counter
     - if 3 fails → set cooldown 30s
     - return CRYPTO_INVALID_MASTER_PASSWORD
  7. await storage.session.set('nexa.crypto.aesKey', base64(rawKey))
  8. reset fail counter
  9. publish CRYPTO_UNLOCKED
  10. return Ok(void)
```

#### `encrypt(plaintext)`

```
PRECONDITIONS:
  - !isLocked()

FLOW:
  1. aesKey = await getActiveKey()  // from session storage
  2. iv = generateSecureBytes(12)
  3. ciphertext = await crypto.subtle.encrypt(
       { name: 'AES-GCM', iv },
       aesKey,
       utf8encode(plaintext),
     )
  4. return base64(iv + ciphertext)
```

#### `decrypt(ciphertext)`

```
PRECONDITIONS:
  - !isLocked()

FLOW:
  1. aesKey = await getActiveKey()
  2. data = base64decode(ciphertext)
  3. iv = data.slice(0, 12)
  4. ciphertext = data.slice(12)
  5. plaintext = await crypto.subtle.decrypt(
       { name: 'AES-GCM', iv },
       aesKey,
       ciphertext,
     )
  6. return utf8decode(plaintext)
```

### 8.5 Anti-responsabilidades

- No conoce estructura de Account (solo cifra strings).
- No loggea master password ni llaves.
- No persiste llaves en `chrome.storage.local` (solo en session).

---

## 9. ThemeService

### 9.1 Responsabilidad

Aplica y persiste el tema seleccionado. Expone lista de temas disponibles.

### 9.2 Interfaz

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
  applyToDocument(doc: Document): void;

  // —— System preference ——
  startSystemListener(): void;
  stopSystemListener(): void;
}

type ThemeName = 'dark' | 'light' | 'nebula' | 'aurora';

interface Theme {
  readonly name: ThemeName;
  readonly label: string;
  readonly description: string;
  readonly preview: { primary: string; background: string; accent: string };
}
```

### 9.3 Dependencias

```typescript
interface ThemeServiceDeps {
  readonly storage: IStorageEngine;
  readonly settingsRepo: ISettingsRepository;
}
```

### 9.4 Métodos detallados

#### `setManual(theme)`

```
FLOW:
  1. settings = await settingsRepo.get()
  2. updated = { ...settings, theme: { mode: 'manual', theme } }
  3. await settingsRepo.save(updated)
  4. apply(theme)
  5. stopSystemListener()
```

#### `setSystem()`

```
FLOW:
  1. settings = await settingsRepo.get()
  2. updated = { ...settings, theme: { mode: 'system', theme: 'dark' } }  // theme field ignored
  3. await settingsRepo.save(updated)
  4. startSystemListener()
  5. apply(systemPref === 'dark' ? 'dark' : 'light')
```

#### `apply(theme)`

```
FLOW:
  document.documentElement.setAttribute('data-theme', theme)
```

#### `startSystemListener()`

```
FLOW:
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  handler = (e) => apply(e.matches ? 'dark' : 'light')
  mediaQuery.addEventListener('change', handler)
  apply(mediaQuery.matches ? 'dark' : 'light')
```

### 9.5 Temas disponibles

```typescript
const AVAILABLE_THEMES: readonly Theme[] = [
  {
    name: 'dark',
    label: 'Oscuro',
    description: 'Tema oscuro premium estilo Linear.',
    preview: { primary: '#6366f1', background: '#09090b', accent: '#a78bfa' },
  },
  {
    name: 'light',
    label: 'Claro',
    description: 'Tema claro estilo Apple.',
    preview: { primary: '#6366f1', background: '#ffffff', accent: '#7c3aed' },
  },
  {
    name: 'nebula',
    label: 'Nebula',
    description: 'Variante oscura con acentos púrpura y magenta.',
    preview: { primary: '#a855f7', background: '#0c0a14', accent: '#ec4899' },
  },
  {
    name: 'aurora',
    label: 'Aurora',
    description: 'Variante con gradientes verde-cyan.',
    preview: { primary: '#06b6d4', background: '#04181f', accent: '#84cc16' },
  },
];
```

---

## 10. ConnectionMonitor

### 10.1 Responsabilidad

Detecta estado de conexión: ONLINE, CAPTIVE_PORTAL, OFFLINE. Publica eventos cuando cambia. Ejecuta probes periódicos via `chrome.alarms`.

### 10.2 Interfaz

```typescript
interface IConnectionMonitor {
  // —— Consultas ——
  getCurrentState(): Promise<ConnectionState>;
  getSnapshot(): Promise<ConnectionSnapshot>;
  getLastChecked(): Promise<number | null>;

  // —— Probes ——
  probe(): Promise<Result<ConnectionState, NexaError>>;

  // —— Lifecycle ——
  start(): void;
  stop(): void;

  // —— Handlers ——
  handleAlarm(alarmName: string): Promise<void>;
  handleSessionLost(event: SessionLostEvent): Promise<void>;
}
```

### 10.3 Dependencias

```typescript
interface ConnectionMonitorDeps {
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly eventBus: IEventBus;
}
```

### 10.4 Métodos detallados

#### `start()`

```
FLOW:
  1. chrome.alarms.create('nexa.heartbeat', { periodInMinutes: 1 })
  2. await probe()  // initial probe
```

#### `probe()`

```
FLOW:
  1. stateBefore = await getCurrentState()
  2. diagnostics.debug('connection', 'Probe iniciado')
  3. probeA = await fetch('http://connectivitycheck.gstatic.com/generate_204',
                          { redirect: 'manual', signal: timeout(5s) })
  4. if probeA.status === 204:
     newState = 'ONLINE'
  else:
     probeB = await fetch('https://secure.etecsa.net:8443/',
                          { signal: timeout(8s) })
     if probeB.ok and probeB.text contains 'formulario':
       newState = 'CAPTIVE_PORTAL'
     elif probeB.ok:
       newState = 'ONLINE'
     else:
       probeC = await fetch('http://1.1.1.1/cdn-cgi/trace',
                            { signal: timeout(5s) })
       if probeC.ok:
         newState = 'ERROR'
       else:
         newState = 'OFFLINE'
  5. await storage.sessions.setConnectionState(newState)
  6. if newState !== stateBefore:
     publish event according to newState
     if stateBefore === 'AUTHENTICATED' and newState not in ['ONLINE', 'AUTHENTICATED']:
       // session probably lost
       publish SESSION_LOST { reason: 'connection_lost' }
  7. return Ok(newState)
```

#### `handleAlarm(alarmName)`

```
FLOW:
  if alarmName === 'nexa.heartbeat':
    await probe()
```

### 10.5 Eventos publicados

| Evento | Cuándo |
|--------|--------|
| `CONNECTION_ONLINE` | Transición a ONLINE |
| `CONNECTION_OFFLINE` | Transición a OFFLINE |
| `CONNECTION_CAPTIVE_PORTAL` | Transición a CAPTIVE_PORTAL |

### 10.6 Eventos escuchados

| Evento | Acción |
|--------|--------|
| `SESSION_LOST` | Forzar probe inmediato (no esperar heartbeat) |

---

## 11. Inicialización de servicios

### 11.1 Orden de instanciación

```typescript
async function bootstrapServices(): Promise<ServiceContainer> {
  // 1. Módulos transversales
  const eventBus = new EventBus();
  const messageBus = new MessageBus();

  // 2. Storage (sin deps)
  const storage = new StorageEngine();
  await storage.migrateAll();

  // 3. Diagnostics (deps: storage, eventBus)
  const diagnostics = new DiagnosticEngine({ storage, eventBus, sanitizer });

  // 4. Crypto (deps: storage, diagnostics, eventBus)
  const crypto = new CryptoService({ storage, diagnostics, eventBus });

  // 5. Theme (deps: storage, settingsRepo)
  const settingsRepo = storage.settings;
  const theme = new ThemeService({ storage, settingsRepo });

  // 6. Connection (deps: storage, diagnostics, eventBus)
  const connection = new ConnectionMonitor({ storage, diagnostics, eventBus });

  // 7. Account (deps: storage, crypto, connector, diagnostics, eventBus, session)
  //    Nota: connector y session se inyectan después (circular dep)
  const accountManager = new AccountManager({
    storage, crypto, diagnostics, eventBus,
    connector: undefined as any,  // filled later
    session: undefined as any,
  });

  // 8. Notification (deps: storage, diagnostics, eventBus, settingsRepo)
  const notification = new NotificationEngine({
    storage, diagnostics, eventBus, settingsRepo,
  });

  // 9. Connector (deps: diagnostics, offscreen bridge, etc.)
  const connector = new EtecsaConnector({
    diagnostics,
    offscreenBridge: new OffscreenBridge(),
    // ...
  });

  // 10. Session (deps: connector, accountManager, storage, crypto, scheduler, notification, diagnostics, connection, eventBus)
  const scheduler = new SchedulerEngine({
    storage, notification, diagnostics, eventBus,
    session: undefined as any,  // filled later
  });

  const session = new SessionManager({
    connector, accountManager, storage, crypto,
    scheduler, notification, diagnostics, connection, eventBus,
  });

  // 11. Resolver circular deps
  accountManager.setConnector(connector);
  accountManager.setSession(session);
  scheduler.setSession(session);

  // 12. Start background services
  connection.start();

  return {
    eventBus, messageBus, storage, diagnostics, crypto,
    theme, connection, accountManager, notification,
    connector, scheduler, session,
  };
}

interface ServiceContainer {
  readonly eventBus: IEventBus;
  readonly messageBus: IMessageBus;
  readonly storage: IStorageEngine;
  readonly diagnostics: IDiagnosticEngine;
  readonly crypto: ICryptoService;
  readonly theme: IThemeService;
  readonly connection: IConnectionMonitor;
  readonly accountManager: IAccountManager;
  readonly notification: INotificationEngine;
  readonly connector: IEtecsaConnector;
  readonly scheduler: ISchedulerEngine;
  readonly session: ISessionManager;
}
```

### 11.2 Manejo de dependencias circulares

`SessionManager ↔ AccountManager` y `SessionManager ↔ SchedulerEngine` tienen dependencias circulares. Solución:

- Constructor recibe `deps` con campos opcionales marcados como `undefined as any`.
- Método `setSession(other)` u otro setter para inyectar después.
- Esto es un patrón aceptable en DI manual.

### 11.3 Suscripción a eventos

Tras instanciación, cada servicio se suscribe a sus eventos:

```typescript
// En bootstrap, después de instanciación:
eventBus.subscribe('SESSION_LOST', session.handleSessionLost);
eventBus.subscribe('SESSION_LOST', notification.handleSessionLost);
eventBus.subscribe('SESSION_LOST', scheduler.handleSessionLost);
eventBus.subscribe('SESSION_LOST', connection.handleSessionLost);

eventBus.subscribe('SESSION_STARTED', scheduler.handleSessionStarted);
eventBus.subscribe('SESSION_STARTED', notification.handleSessionStarted);

eventBus.subscribe('BALANCE_LOW', notification.handleBalanceLow);
eventBus.subscribe('CONNECTOR_DEGRADED', notification.handleConnectorDegraded);

eventBus.subscribe('CONNECTION_OFFLINE', session.handleConnectionOffline);
eventBus.subscribe('CONNECTION_CAPTIVE_PORTAL', session.handleConnectionCaptivePortal);

eventBus.subscribe('SCHEDULER_TASK_COMPLETED', notification.handleSchedulerTaskCompleted);

// Diagnostics escucha TODO
eventBus.subscribeAll(diagnostics.logEvent);
```

---

## 12. Pendientes para Fases siguientes

### Documento 3
- Detalle de namespaces de storage.
- Repositories completos.
- Migrations.

### Documento 4
- Catálogo completo de NexaError.
- Mensajes en español y acciones recomendadas.

### Fase 5
- Implementar interfaces en `src/services/`.
- Implementar DI container.
- Tests unitarios con mocks.

### Fase 6
- Implementar `EtecsaConnector` con tipos concretos.

### Fase 7
- UI consume servicios via message bus.

---

**Fin del Documento 2.**
Continúa en `03-storage-architecture.md`.
