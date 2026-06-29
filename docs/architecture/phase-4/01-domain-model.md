# NEXA NautaX — Domain Model

**Fase:** 4
**Documento:** 1 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Definición de las entidades del dominio, sus relaciones y diagramas. **No es implementación** — es contrato de datos. La implementación real (TypeScript + Zod) se hace en Fase 5.

---

## 1. Visión General

### 1.1 Filosofía de modelado

- **Entidades inmutables** — toda mutación genera nueva instancia.
- **Branded types** — IDs y tokens tienen tipos distinctivos para evitar bugs de refactoring.
- **Validación runtime con Zod** — todo dato que entra o sale de storage pasa por schema.
- **Separación Storage ↔ Dominio** — entidades de storage pueden diferir de entidades de dominio (ej: `Account` dominio vs `AccountRecord` storage con `encryptedPassword`).

### 1.2 Mapa de entidades

```
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN ENTITIES                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Account   │───►│ Session  │───►│ History  │              │
│  │          │    │  Data    │    │  Record  │              │
│  └────┬─────┘    └────┬─────┘    └──────────┘              │
│       │                │                                      │
│       │                ▼                                      │
│       │          ┌──────────┐                                 │
│       │          │ Balance  │                                 │
│       │          └──────────┘                                 │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐    ┌──────────────┐                          │
│  │ Reconnect│    │ SchedulerTask│                          │
│  │  Policy  │    │              │                          │
│  └──────────┘    └──────────────┘                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Settings │    │  Theme   │    │   Log    │              │
│  │          │    │ Setting  │    │  Entry   │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Network  │    │ Connector│    │  Backup  │              │
│  │ Record   │    │  Health  │    │ Package  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│  ┌──────────┐    ┌──────────┐                              │
│  │Notification│   │ Crypto   │                              │
│  │          │    │ Verifier │                              │
│  └──────────┘    └──────────┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Branded types

Definidos en `src/types/branded.ts`. Estos tipos previenen errores comunes como pasar un `AccountId` donde se espera un `SessionId`.

```typescript
type AccountId = string & { readonly __brand: 'AccountId' };
type SessionId = string & { readonly __brand: 'SessionId' };
type SchedulerTaskId = string & { readonly __brand: 'SchedulerTaskId' };
type NotificationId = string & { readonly __brand: 'NotificationId' };
type LogId = string & { readonly __brand: 'LogId' };
type NetworkRecordId = string & { readonly __brand: 'NetworkRecordId' };
type CsrfToken = string & { readonly __brand: 'CsrfToken' };
type AttributeUuid = string & { readonly __brand: 'AttributeUuid' };
type WlanUserIp = string & { readonly __brand: 'WlanUserIp' };
type InstallationId = string & { readonly __brand: 'InstallationId' };
type TraceId = string & { readonly __brand: 'TraceId' };

// Helper factories
function asAccountId(s: string): AccountId {
  return s as AccountId;
}
// ... etc
```

---

## 2. Account Entity

### 2.1 Definición

Representa una cuenta Nauta ETECSA guardada por el usuario.

```typescript
interface Account {
  /** Identificador único de la cuenta. */
  readonly id: AccountId;

  /** Alias dado por el usuario (ej: "Cuenta personal"). */
  readonly alias: string;

  /** Usuario Nauta (ej: pepe@nauta.com.cu). */
  readonly username: string;

  /** Contraseña cifrada con AES-GCM. Formato: base64(iv + ciphertext). */
  readonly encryptedPassword: string;

  /** Tipo de cuenta. Solo 'prepaid' en Fase 1. */
  readonly type: AccountType;

  /** Política de reconexión automática. */
  readonly reconnectPolicy: ReconnectPolicy;

  /** Timestamp de creación (epoch ms). */
  readonly createdAt: number;

  /** Timestamp de última modificación (epoch ms). */
  readonly updatedAt: number;

  /** Timestamp de último uso en login (epoch ms) o null si nunca. */
  readonly lastUsed: number | null;

  /** Si esta es la cuenta actualmente seleccionada en la UI. */
  readonly isSelected: boolean;
}

type AccountType = 'prepaid';
// Reservado para futuro: | 'postpaid';

interface ReconnectPolicy {
  /** Si la reconexión automática está activada para esta cuenta. */
  readonly enabled: boolean;

  /** Máximo número de reintentos antes de rendirse. */
  readonly maxRetries: number;

  /** Estrategia de backoff entre reintentos. */
  readonly backoffStrategy: 'fixed' | 'exponential';

  /** Delay inicial en ms antes del primer reintento. */
  readonly initialDelayMs: number;

  /** Delay máximo en ms (cap para exponencial). */
  readonly maxDelayMs: number;

  /** Qué hacer si el motivo de desconexión fue saldo cero. */
  readonly onZeroBalance: 'stop' | 'switch';

  /** Si se debe notificar al usuario al reconectar exitosamente. */
  readonly notifyOnReconnect: boolean;
}
```

### 2.2 Valores default de ReconnectPolicy

```typescript
const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  enabled: true,
  maxRetries: 3,
  backoffStrategy: 'exponential',
  initialDelayMs: 30_000,   // 30 segundos
  maxDelayMs: 300_000,      // 5 minutos
  onZeroBalance: 'stop',
  notifyOnReconnect: true,
};
```

### 2.3 Validaciones

| Campo | Regla | Mensaje de error (es) |
|-------|-------|----------------------|
| `id` | No vacío, formato `acc_[a-z0-9]{16}` | "ID de cuenta inválido" |
| `alias` | 1-50 chars, no solo whitespace | "Alias debe tener entre 1 y 50 caracteres" |
| `username` | Regex `^[a-zA-Z0-9._-]+(@nauta\.(com\|co)\.cu)?$` | "Usuario inválido" |
| `encryptedPassword` | No vacío, formato `AES:base64data` | "Contraseña cifrada inválida" |
| `type` | `'prepaid'` (único válido en Fase 1) | "Tipo de cuenta no soportado" |
| `reconnectPolicy.maxRetries` | 1-10 | "Reintentos debe estar entre 1 y 10" |
| `reconnectPolicy.initialDelayMs` | 5_000 - 600_000 | "Delay inicial debe estar entre 5s y 10min" |
| `reconnectPolicy.maxDelayMs` | ≥ `initialDelayMs`, ≤ 3_600_000 | "Delay máximo inválido" |

### 2.4 Relaciones

```
Account 1───0..1 SessionData     (una cuenta puede tener 0 o 1 sesión activa)
Account 1───0..* HistoryRecord   (una cuenta tiene historial de sesiones pasadas)
Account 1───0..* SchedulerTask   (una cuenta puede tener tareas programadas)
Account 1───0..1 Balance         (saldo actual de la cuenta, cacheado)
```

### 2.5 Inputs (para crear/editar)

```typescript
interface NewAccountInput {
  readonly alias: string;
  readonly username: string;
  readonly password: string;            // plaintext — solo en memoria
  readonly type: AccountType;
  readonly reconnectPolicy?: Partial<ReconnectPolicy>;
}

interface AccountUpdateInput {
  readonly alias?: string;
  readonly username?: string;
  readonly password?: string;           // si se cambia, se re-cifra
  readonly type?: AccountType;
  readonly reconnectPolicy?: Partial<ReconnectPolicy>;
}
```

---

## 3. SessionData Entity

### 3.1 Definición

Estado de la sesión ETECSA activa. **No es el historial** — es la sesión vigente.

```typescript
interface SessionData {
  /** AccountId de la cuenta con la sesión activa. */
  readonly accountId: AccountId;

  /** Usuario Nauta de la cuenta. */
  readonly username: string;

  /** Token CSRF extraído del formulario inicial. */
  readonly csrfToken: CsrfToken;

  /** Token de sesión devuelto por ETECSA tras login. */
  readonly attributeUuid: AttributeUuid;

  /** IP del cliente detectada por ETECSA en portal cautivo. */
  readonly wlanUserIp: WlanUserIp;

  /** Logger ID del portal cautivo. */
  readonly loggerId: string;

  /** Timestamp de inicio de sesión (epoch ms). */
  readonly startedAt: number;

  /** Timestamp del último sync con ETECSA (epoch ms). */
  readonly lastSync: number;

  /** Cookies set por ETECSA (JSESSIONID, etc.) — serializadas. */
  readonly cookies: Readonly<Record<string, string>>;

  /** Estrategia del connector que logró el login. */
  readonly loginStrategy: StrategyName;
}

type StrategyName =
  | 'KnownEndpoint'
  | 'DiscoveredEndpoint'
  | 'ScrapingDom'
  | 'ScrapingRegex'
  | 'ManualFallback';
```

### 3.2 Derivados

Estos valores no se persisten — se calculan en runtime:

```typescript
interface SessionStatus {
  readonly data: SessionData;
  readonly durationMs: number;          // now - startedAt
  readonly timeRemaining?: Duration;    // de getLeftTime
  readonly balance?: Balance;           // de getSessionInfo
  readonly lastSyncAge: number;         // now - lastSync
}
```

### 3.3 SessionRecord (historial)

```typescript
interface SessionRecord {
  /** Identificador único del registro de historial. */
  readonly id: SessionId;

  /** Cuenta con la que se hizo la sesión. */
  readonly accountId: AccountId;

  /** Username de la cuenta (denormalizado para queries históricas). */
  readonly username: string;

  /** Timestamp de inicio (epoch ms). */
  readonly startedAt: number;

  /** Timestamp de fin (epoch ms) o null si sigue activa. */
  readonly endedAt: number | null;

  /** Duración en ms o null si sigue activa. */
  readonly durationMs: number | null;

  /** Saldo al inicio de la sesión. */
  readonly balanceStart?: number;

  /** Saldo al final de la sesión. */
  readonly balanceEnd?: number;

  /** Consumo estimado en CUP. */
  readonly estimatedUsage?: number;

  /** Motivo de fin de sesión. */
  readonly endReason?: SessionEndReason;

  /** Estrategia del connector que logró el login. */
  readonly loginStrategy: StrategyName;
}

type SessionEndReason =
  | 'manual'              // logout explícito del usuario
  | 'session_expired'     // ETECSA cerró por timeout
  | 'connection_lost'     // perdió conexión
  | 'balance_zero'        // saldo agotado
  | 'browser_closed'      // cerró navegador
  | 'switched_account'    // cambió a otra cuenta
  | 'error';              // error indeterminado
```

### 3.4 Validaciones

| Campo | Regla |
|-------|-------|
| `accountId` | Debe existir en `nexa.accounts` |
| `csrfToken` | 32 chars hex |
| `attributeUuid` | Alphanumeric, 16-128 chars |
| `wlanUserIp` | IPv4 válida |
| `startedAt` | > 0 |
| `lastSync` | ≥ `startedAt` |

---

## 4. Balance Entity

### 4.1 Definición

Información económica de la cuenta.

```typescript
interface Balance {
  /** AccountId de la cuenta. */
  readonly accountId: AccountId;

  /** Saldo disponible en CUP. */
  readonly amount: number;

  /** Moneda. Siempre 'CUP' en Fase 1. */
  readonly currency: 'CUP';

  /** Timestamp de última actualización (epoch ms). */
  readonly lastUpdated: number;

  /** Fecha de bloqueo de la cuenta (epoch ms) o null si no aplica. */
  readonly expiresAt: number | null;

  /** Tiempo restante de conexión basado en saldo (ms) o null. */
  readonly estimatedTimeRemaining?: number;
}
```

### 4.2 Validaciones

| Campo | Regla |
|-------|-------|
| `amount` | ≥ 0, ≤ 10000 (sanity check) |
| `currency` | `'CUP'` |
| `lastUpdated` | > 0 |
| `expiresAt` | > `lastUpdated` o null |

### 4.3 Reglas de negocio

- `amount < lowBalanceThreshold` (default 5.0) → publica evento `BALANCE_LOW`.
- `amount === 0` → termina sesión con `endReason: 'balance_zero'`.
- `expiresAt` en pasado → cuenta bloqueada, no se puede usar para login.

---

## 5. SchedulerTask Entity

### 5.1 Definición

Tarea programada por el usuario.

```typescript
interface SchedulerTask {
  /** Identificador único de la tarea. */
  readonly id: SchedulerTaskId;

  /** Tipo de tarea. */
  readonly type: SchedulerTaskType;

  /** Disparador de la tarea. */
  readonly trigger: SchedulerTrigger;

  /** Si la tarea está activa. */
  readonly enabled: boolean;

  /** Cuenta a la que aplica (null = cuenta activa al momento de ejecución). */
  readonly accountId: AccountId | null;

  /** Timestamp de creación (epoch ms). */
  readonly createdAt: number;

  /** Timestamp de próxima ejecución programada (epoch ms) o null. */
  readonly nextRunAt: number | null;

  /** Timestamp de última ejecución (epoch ms) o null. */
  readonly lastExecutedAt: number | null;

  /** Estado actual. */
  readonly status: SchedulerTaskStatus;

  /** Último error ocurrido durante ejecución o null. */
  readonly lastError: NexaError | null;

  /** Si la tarea es recurrente (vs one-shot). */
  readonly recurring: boolean;
}

type SchedulerTaskType =
  | 'LOGOUT_TIMER'           // logout en X minutos
  | 'LOGOUT_TIME'            // logout a hora específica
  | 'MAX_SESSION_TIME';      // logout si sesión supera X horas

type SchedulerTrigger =
  | { readonly kind: 'delay'; readonly minutes: number }
  | { readonly kind: 'atTime'; readonly hour: number; readonly minute: number; readonly daysOfWeek?: number[] }
  | { readonly kind: 'maxSession'; readonly hours: number };

type SchedulerTaskStatus =
  | 'pending'        // esperando ejecución
  | 'executing'      // en progreso
  | 'completed'      // ejecutada exitosamente (one-shot)
  | 'failed'         // falló la última ejecución
  | 'cancelled';     // cancelada por usuario
```

### 5.2 Validaciones

| Campo | Regla |
|-------|-------|
| `trigger.minutes` (delay) | 1-1440 (1 min a 24h) |
| `trigger.hour` (atTime) | 0-23 |
| `trigger.minute` (atTime) | 0-59 |
| `trigger.daysOfWeek` | Array de 0-6 (Dom-Sáb), opcional |
| `trigger.hours` (maxSession) | 1-72 |

### 5.3 Reglas de negocio

- Si `recurring === false` y `status === 'completed'` → no se vuelve a ejecutar.
- Si `recurring === true` → `nextRunAt` se recalcula tras cada ejecución.
- Tareas con `enabled === false` no se ejecutan pero permanecen en storage.

---

## 6. Settings Entity

### 6.1 Definición

Configuración global de la extensión.

```typescript
interface Settings {
  /** Configuración de apariencia. */
  readonly theme: ThemeSetting;

  /** Configuración de comportamiento. */
  readonly behavior: BehaviorSettings;

  /** Configuración de notificaciones. */
  readonly notifications: NotificationSettings;

  /** Configuración de seguridad. */
  readonly security: SecuritySettings;

  /** Configuración de developer mode. */
  readonly developer: DeveloperSettings;

  /** Versión del esquema de settings. */
  readonly schemaVersion: number;

  /** Timestamp de última modificación. */
  readonly updatedAt: number;
}

interface ThemeSetting {
  readonly mode: 'manual' | 'system';
  readonly theme: 'dark' | 'light' | 'nebula' | 'aurora';  // solo dark/light si mode=system
}

interface BehaviorSettings {
  /** Restaurar sesión al abrir el navegador. */
  readonly restoreSessionOnStartup: boolean;

  /** Reconexión automática global (override por cuenta). */
  readonly autoReconnectGlobal: boolean;

  /** Iniciar extensión con Chrome. */
  readonly startWithBrowser: boolean;

  /** Qué hacer al cerrar el popup. */
  readonly onPopupClose: 'keep_session' | 'logout';
}

interface NotificationSettings {
  /** Master switch para todas las notificaciones. */
  readonly enabled: boolean;

  /** Notificar al perder conexión. */
  readonly onDisconnect: boolean;

  /** Notificar al reconectar exitosamente. */
  readonly onReconnect: boolean;

  /** Notificar cuando el saldo cae bajo threshold. */
  readonly onLowBalance: boolean;

  /** Threshold de saldo bajo (CUP). */
  readonly lowBalanceThreshold: number;

  /** Notificar cuando el tiempo restante cae bajo threshold. */
  readonly onLowTime: boolean;

  /** Threshold de tiempo restante bajo (minutos). */
  readonly lowTimeThresholdMinutes: number;

  /** Notificar errores del connector. */
  readonly onConnectorError: boolean;

  /** Nivel de detalle de toasts. */
  readonly verbosity: 'minimal' | 'normal' | 'detailed';
}

interface SecuritySettings {
  /** Auto-lock después de X minutos de inactividad (0 = nunca). */
  readonly autoLockMinutes: number;

  /** Requerir unlock al abrir popup. */
  readonly requireUnlockOnOpen: boolean;
}

interface DeveloperSettings {
  /** Si Developer Mode está visible en la nav. */
  readonly visible: boolean;

  /** Nivel de logging global. */
  readonly logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  /** Mostrar timing detallado de operaciones HTTP. */
  readonly verboseNetwork: boolean;

  /** Mostrar valores intermedios de strategies. */
  readonly traceStrategies: boolean;
}
```

### 6.2 Defaults

```typescript
const DEFAULT_SETTINGS: Settings = {
  theme: { mode: 'manual', theme: 'dark' },
  behavior: {
    restoreSessionOnStartup: false,
    autoReconnectGlobal: true,
    startWithBrowser: false,
    onPopupClose: 'keep_session',
  },
  notifications: {
    enabled: true,
    onDisconnect: true,
    onReconnect: true,
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
    visible: false,        // oculto por defecto
    logLevel: 'INFO',
    verboseNetwork: false,
    traceStrategies: false,
  },
  schemaVersion: 1,
  updatedAt: Date.now(),
};
```

---

## 7. DiagnosticLog Entity

### 7.1 Definición

Entrada de log del sistema.

```typescript
interface DiagnosticLog {
  /** Identificador único del log. */
  readonly id: LogId;

  /** Timestamp (epoch ms). */
  readonly timestamp: number;

  /** Nivel de severidad. */
  readonly level: LogLevel;

  /** Categoría del log. */
  readonly category: LogCategory;

  /** Mensaje sanitizado (sin datos sensibles). */
  readonly message: string;

  /** Detalles opcionales sanitizados. */
  readonly details?: unknown;

  /** Trace ID para correlacionar operaciones multi-step. */
  readonly traceId?: TraceId;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

type LogCategory =
  | 'system'
  | 'session'
  | 'account'
  | 'scheduler'
  | 'connector'
  | 'network'
  | 'storage'
  | 'crypto'
  | 'theme'
  | 'notification'
  | 'connection'
  | 'ui';
```

### 7.2 Política de retención

- Máximo **5,000 logs** en storage.
- Política FIFO — los más antiguos se eliminan al agregar nuevos.
- Limpieza manual desde Developer Mode.

### 7.3 Sanitización obligatoria

Antes de persistir, todo log pasa por `sanitize()` que reemplaza:

- `password=*` → `password=***`
- `ATTRIBUTE_UUID=*` → `ATTRIBUTE_UUID=***`
- `CSRFHW=*` → `CSRFHW=***`
- `JSESSIONID=*` → `JSESSIONID=***`
- Emails → `***@***`
- IPs → `***.***.***.***`

---

## 8. NetworkRecord Entity

### 8.1 Definición

Registro de request HTTP al connector ETECSA.

```typescript
interface NetworkRecord {
  /** Identificador único del registro. */
  readonly id: NetworkRecordId;

  /** Timestamp (epoch ms). */
  readonly timestamp: number;

  /** Método HTTP. */
  readonly method: 'GET' | 'POST';

  /** URL del request (sanitizada). */
  readonly url: string;

  /** Status code de respuesta o null si falló. */
  readonly status: number | null;

  /** Duración en ms. */
  readonly durationMs: number;

  /** Tamaño del request body en bytes (sanitizado). */
  readonly requestSize: number;

  /** Tamaño del response body en bytes. */
  readonly responseSize: number;

  /** Estrategia del connector que originó el request. */
  readonly strategy: StrategyName;

  /** Error si el request falló. */
  readonly error?: string;

  /** Trace ID para correlación. */
  readonly traceId?: TraceId;
}
```

### 8.2 Política de retención

- Máximo **1,000 registros** en storage.
- Política FIFO.

### 8.3 Sanitización

- URL: query params sanitizados (tokens en URL → `***`).
- Request body: NO se persiste — solo tamaño.
- Response body: NO se persiste — solo tamaño.
- Headers: NO se persisten — solo se muestran en Developer Mode si `verboseNetwork` activado (en tiempo real, no persistido).

---

## 9. ConnectorHealth Entity

### 9.1 Definición

Estado de salud del ETECSA connector. **No se persiste** — se mantiene en memoria del SW (se pierde al reiniciar, lo cual es aceptable porque se reconstruye tras primera operación).

```typescript
interface ConnectorHealth {
  /** Última operación realizada. */
  readonly lastOperation: 'login' | 'logout' | 'balance' | 'time' | 'verify' | 'probe' | null;

  /** Timestamp del último éxito (epoch ms) o null. */
  readonly lastSuccessAt: number | null;

  /** Último error ocurrido o null. */
  readonly lastError: NexaError | null;

  /** Estrategia actualmente en uso. */
  readonly currentStrategy: StrategyName;

  /** Fallos consecutivos actuales. */
  readonly consecutiveFailures: number;

  /** Total de operaciones realizadas. */
  readonly totalOperations: number;

  /** Total de operaciones exitosas. */
  readonly totalSuccesses: number;

  /** Total de operaciones fallidas. */
  readonly totalFailures: number;
}
```

### 9.2 Reglas

- `consecutiveFailures` se reinicia a 0 tras un éxito.
- Tras 3 fallos consecutivos, se publica evento `CONNECTOR_DEGRADED`.
- Tras éxito tras fallos, se publica evento `CONNECTOR_RECOVERED`.

---

## 10. Notification Entity

### 10.1 Definición

Notificación activa mostrada al usuario (Toast NEXA custom).

```typescript
interface Notification {
  /** Identificador único. */
  readonly id: NotificationId;

  /** Variante visual. */
  readonly variant: 'success' | 'error' | 'warning' | 'info';

  /** Título corto (español). */
  readonly title: string;

  /** Mensaje descriptivo opcional (español). */
  readonly message?: string;

  /** Acción opcional (botón en el toast). */
  readonly action?: {
    readonly label: string;
    readonly type: 'open_sidepanel' | 'open_popup' | 'dismiss' | 'custom';
    readonly payload?: unknown;
  };

  /** Timestamp de creación (epoch ms). */
  readonly createdAt: number;

  /** Duración en ms (0 = no auto-dismiss). */
  readonly durationMs: number;

  /** Si la notificación es persistente. */
  readonly persistent: boolean;

  /** Si fue dismissada. */
  readonly dismissed: boolean;

  /** Source del evento (qué servicio la originó). */
  readonly source: string;
}
```

### 10.2 Defaults por variante

| Variante | DurationMs | Persistent |
|----------|-----------|------------|
| success | 5000 | false |
| error | 0 (no auto) | true |
| warning | 8000 | false |
| info | 5000 | false |

### 10.3 Política

- Máximo 3 notificaciones activas simultáneamente.
- Si se excede, las más antiguas se auto-dismissan (a menos que sean `persistent`).
- Badge en icono de extensión muestra conteo de no-dismissadas.

---

## 11. BackupPackage Entity

### 11.1 Definición

Estructura del archivo de backup exportable/importable.

```typescript
interface BackupPackage {
  /** Versión del formato de backup. */
  readonly version: 1;

  /** Timestamp de creación (epoch ms). */
  readonly createdAt: number;

  /** Versión de la extensión que generó el backup. */
  readonly extensionVersion: string;

  /** Versiones de schema por namespace. */
  readonly schemaVersions: Readonly<Record<string, number>>;

  /** ID de instalación (para detectar cross-install backups). */
  readonly installationId: InstallationId;

  /** Datos exportados. */
  readonly data: BackupData;

  /** Hash de integridad (SHA-256 del data serializado). */
  readonly checksum: string;
}

interface BackupData {
  /** Cuentas guardadas (credenciales cifradas). */
  readonly accounts: readonly Account[];

  /** Configuraciones. */
  readonly settings: Settings;

  /** Historial de sesiones. */
  readonly history: readonly SessionRecord[];

  /** Tareas programadas. */
  readonly scheduler: readonly SchedulerTask[];

  /** Preferencias adicionales. */
  readonly preferences: Readonly<Record<string, unknown>>;
}
```

### 11.2 Reglas

- `version === 1` obligatorio en Fase 1.
- `checksum` valida integridad al importar.
- Si `installationId` difiere de la instalación actual → las credenciales NO se pueden descifrar (avisar al usuario).

### 11.3 Validación al importar

```typescript
const backupSchema = z.object({
  version: z.literal(1),
  createdAt: z.number().positive(),
  extensionVersion: z.string(),
  schemaVersions: z.record(z.string(), z.number()),
  installationId: z.string(),
  data: z.object({
    accounts: z.array(accountSchema),
    settings: settingsSchema,
    history: z.array(sessionRecordSchema),
    scheduler: z.array(schedulerTaskSchema),
    preferences: z.record(z.string(), z.unknown()),
  }),
  checksum: z.string().length(64),  // SHA-256 hex
});
```

---

## 12. ConnectionState Entity

### 12.1 Definición

Estado de conexión del sistema. **No se persiste como entidad** — se deriva de `ConnectionMonitor` y se publica como evento. Sin embargo, se guarda el último estado conocido en storage para sobrevivir restarts del SW.

```typescript
type ConnectionState =
  | 'ONLINE'
  | 'CAPTIVE_PORTAL'
  | 'CONNECTING'
  | 'AUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'OFFLINE'
  | 'ERROR';

interface ConnectionSnapshot {
  readonly state: ConnectionState;
  readonly lastChecked: number;
  readonly lastTransition: number;     // último cambio de estado
  readonly previousState: ConnectionState;
}
```

### 12.2 Transiciones válidas

```
UNKNOWN → ONLINE | CAPTIVE_PORTAL | OFFLINE | ERROR

ONLINE → CAPTIVE_PORTAL | OFFLINE | ERROR
CAPTIVE_PORTAL → CONNECTING | OFFLINE | ERROR
CONNECTING → AUTHENTICATED | CAPTIVE_PORTAL | ERROR
AUTHENTICATED → SESSION_EXPIRED | CAPTIVE_PORTAL | OFFLINE | ERROR
SESSION_EXPIRED → CONNECTING | CAPTIVE_PORTAL
OFFLINE → ONLINE | CAPTIVE_PORTAL | ERROR
ERROR → cualquier estado (tras probe exitoso)
```

---

## 13. NexaError Entity

### 13.1 Definición

Error tipado de la aplicación.

```typescript
interface NexaError {
  /** Código único del error. */
  readonly code: NexaErrorCode;

  /** Categoría del error. */
  readonly category: NexaErrorCategory;

  /** Mensaje técnico (inglés, para Developer Mode). */
  readonly technicalMessage: string;

  /** Mensaje para el usuario (español). */
  readonly userMessage: string;

  /** Acción recomendada (español). */
  readonly recommendedAction: string;

  /** Si el error es recuperable con reintento. */
  readonly retryable: boolean;

  /** Error causa (encadenamiento). */
  readonly cause?: NexaError | unknown;

  /** Timestamp (epoch ms). */
  readonly timestamp: number;

  /** Trace ID para correlación. */
  readonly traceId?: TraceId;
}

type NexaErrorCategory =
  | 'AUTH_ERROR'
  | 'SESSION_ERROR'
  | 'NETWORK_ERROR'
  | 'CONNECTOR_ERROR'
  | 'STORAGE_ERROR'
  | 'CRYPTO_ERROR'
  | 'SCHEDULER_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

type NexaErrorCode =
  // AUTH
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_ACCOUNT_BLOCKED'
  | 'AUTH_UNKNOWN_FAILURE'
  // SESSION
  | 'SESSION_EXPIRED'
  | 'SESSION_IN_USE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_ACTIVE'
  // NETWORK
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_DNS'
  | 'NETWORK_OFFLINE'
  | 'PORTAL_UNREACHABLE'
  // CONNECTOR
  | 'CONNECTOR_PARSER_FAILED'
  | 'CONNECTOR_CSRF_MISSING'
  | 'CONNECTOR_ATTRIBUTE_UUID_MISSING'
  | 'CONNECTOR_DEGRADED'
  // BALANCE
  | 'BALANCE_ZERO'
  | 'BALANCE_UNAVAILABLE'
  // STORAGE
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_FULL'
  | 'STORAGE_CORRUPT'
  // CRYPTO
  | 'CRYPTO_INVALID_MASTER_PASSWORD'
  | 'CRYPTO_NOT_INITIALIZED'
  | 'CRYPTO_LOCKED'
  | 'CRYPTO_DECRYPT_FAILED'
  | 'CRYPTO_ENCRYPT_FAILED'
  // SCHEDULER
  | 'SCHEDULER_TASK_NOT_FOUND'
  | 'SCHEDULER_INVALID_TRIGGER'
  // VALIDATION
  | 'VALIDATION_FAILED'
  // UNKNOWN
  | 'UNKNOWN_ERROR';
```

> El detalle completo de mensajes en español y acciones recomendadas por cada código está en el **Documento 4 — Error Handling Specification**.

---

## 14. CryptoVerifier Entity

### 14.1 Definición

Datos persistentes del cifrado (en `chrome.storage.local`).

```typescript
interface CryptoVerifier {
  /** Sal para PBKDF2 (base64 de 16 bytes). */
  readonly salt: string;

  /** Verifier cifrado: encrypt('NEXA_VERIFIER_v1', aesKey). */
  readonly verifier: string;

  /** Parámetros de KDF. */
  readonly kdfParams: {
    readonly algorithm: 'PBKDF2';
    readonly hash: 'SHA-256';
    readonly iterations: 250_000;
  };

  /** Versión del esquema. */
  readonly schemaVersion: number;

  /** Timestamp de creación. */
  readonly createdAt: number;
}
```

### 14.2 Datos efímeros (en `chrome.storage.session`)

```typescript
interface CryptoSessionState {
  /** Llave AES derivada (raw bytes en base64). */
  readonly aesKey: string;            // base64(32 bytes)

  /** Timestamp de derivación. */
  readonly derivedAt: number;
}
```

---

## 15. Meta Entity

### 15.1 Definición

Metadatos de la instalación.

```typescript
interface Meta {
  /** ID único de instalación. */
  readonly installationId: InstallationId;

  /** Versión de la extensión. */
  readonly extensionVersion: string;

  /** Timestamp de primera instalación. */
  readonly installedAt: number;

  /** Versiones de schema por namespace. */
  readonly schemaVersions: Readonly<Record<string, number>>;

  /** Timestamp de último inicio del SW. */
  readonly lastStartup: number;
}
```

### 15.2 Uso

- `installationId` se genera en `onInstalled` y nunca cambia.
- `schemaVersions` se usa para ejecutar migrations al actualizar la extensión.
- `lastStartup` se actualiza en cada `onStartup` del SW.

---

## 16. Diagrama de relaciones

```
                    ┌─────────────────────┐
                    │       Meta          │
                    │  installationId     │
                    │  schemaVersions     │
                    └─────────────────────┘
                            │
                            │ used by migrations
                            ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Account    │───►│  SessionData │───►│   Balance    │
│              │    │   (active)   │    │              │
│ - id         │    │ - accountId  │    │ - accountId  │
│ - alias      │    │ - csrfToken  │    │ - amount     │
│ - username   │    │ - attributeU.│    │ - expiresAt  │
│ - encrPwd    │    │ - wlanUserIp │    └──────────────┘
│ - policy     │    │ - startedAt  │
└──────┬───────┘    └──────┬───────┘
       │                   │
       │ 1              0..*│
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│SchedulerTask │    │SessionRecord │
│              │    │  (history)   │
│ - id         │    │ - id         │
│ - accountId  │    │ - accountId  │
│ - trigger    │    │ - startedAt  │
│ - nextRunAt  │    │ - endedAt    │
└──────────────┘    │ - endReason  │
                    └──────────────┘

┌──────────────┐    ┌──────────────┐
│  Settings    │    │   Crypto     │
│              │    │  Verifier    │
│ - theme      │    │              │
│ - behavior   │    │ - salt       │
│ - notif.     │    │ - verifier   │
│ - security   │    │ - kdfParams  │
│ - developer  │    └──────────────┘
└──────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│DiagnosticLog │    │NetworkRecord │    │Notification  │
│              │    │              │    │              │
│ - level      │    │ - method     │    │ - variant    │
│ - category   │    │ - url        │    │ - title      │
│ - message    │    │ - status     │    │ - message    │
│ - traceId    │    │ - durationMs │    │ - durationMs │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐
│ConnectorHealth│   │BackupPackage │
│ (in-memory)  │    │              │
│              │    │ - version    │
│ - lastOp     │    │ - data       │
│ - lastError  │    │ - checksum   │
│ - currentStr.│    └──────────────┘
└──────────────┘
```

---

## 17. Enums y tipos compartidos

### 17.1 StrategyName

```typescript
type StrategyName =
  | 'KnownEndpoint'
  | 'DiscoveredEndpoint'
  | 'ScrapingDom'
  | 'ScrapingRegex'
  | 'ManualFallback';
```

### 17.2 Duration

```typescript
interface Duration {
  readonly ms: number;
}

// Helpers
function durationFromMs(ms: number): Duration;
function durationFromHHMMSS(hhmmss: string): Duration;
function formatDuration(d: Duration, format: 'hhmmss' | 'mmss' | 'human'): string;
```

### 17.3 HttpTiming

```typescript
interface HttpTiming {
  readonly dns: number;
  readonly tcp: number;
  readonly tls: number;
  readonly ttfb: number;
  readonly total: number;
}
```

---

## 18. Pendientes para Fases siguientes

### Fase 4 (Documentos 2, 3, 4)
- Documento 2: Interfaces detalladas de servicios con métodos.
- Documento 3: Namespaces de storage, repositories, migrations.
- Documento 4: Catálogo completo de NexaError con mensajes y acciones.

### Fase 5
- Implementar tipos en `src/types/`.
- Implementar Zod schemas en `src/storage/schemas/`.
- Implementar factories para branded types.

### Fase 6
- Implementar EtecsaConnector con entidades de dominio.
- Validar SessionData con Zod antes de persistir.

### Fase 8
- Tests de que entidades inválidas son rechazadas por Zod.
- Tests de migraciones de schema.

---

**Fin del Documento 1.**
Continúa en `02-service-layer-specification.md`.
