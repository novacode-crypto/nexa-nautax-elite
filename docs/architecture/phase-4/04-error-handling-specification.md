# NEXA NautaX — Error Handling Specification

**Fase:** 4
**Documento:** 4 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Catálogo completo de errores, sus mensajes en español, acciones recomendadas, y estrategia de propagación. Vinculante para Fases 5-8.

---

## 1. Filosofía de Errores

### 1.1 Principios

1. **Errores como valores, no excepciones** — toda función retorna `Result<T, NexaError>`.
2. **Bilingüe** — `technicalMessage` en inglés para Developer Mode, `userMessage` y `recommendedAction` en español para UI.
3. **Acción siempre recomendada** — el usuario nunca debe preguntarse "¿qué hago ahora?".
4. **Trazabilidad** — todo error tiene `traceId` para seguir el flujo en logs.
5. **Categorización** — cada error pertenece a una categoría que determina el comportamiento del UI.

### 1.2 Propagación

```
ETECSA Connector
   │ returns Result<T, EtecsaError>
   ▼
Application Service
   │ wraps EtecsaError into NexaError if needed
   │ returns Result<T, NexaError>
   ▼
Message Bus
   │ returns ExtensionResponse<T> = Result<T, NexaError>
   ▼
UI (Zustand action)
   │ handles Result
   │ if error → dispatch to NotificationEngine
   ▼
NotificationEngine
   │ shows Toast NEXA with userMessage + recommendedAction
```

### 1.3 Estructura NexaError

```typescript
interface NexaError {
  readonly code: NexaErrorCode;            // código único
  readonly category: NexaErrorCategory;    // categoría
  readonly technicalMessage: string;       // inglés, para Developer Mode
  readonly userMessage: string;            // español, para UI
  readonly recommendedAction: string;      // español, qué hacer
  readonly retryable: boolean;             // si vale la pena reintentar
  readonly cause?: NexaError | unknown;    // error causa (encadenamiento)
  readonly timestamp: number;              // epoch ms
  readonly traceId?: TraceId;              // correlación con logs
}
```

---

## 2. Catálogo Completo de Errores

### 2.1 AUTH_ERROR

#### AUTH_INVALID_CREDENTIALS

| Campo | Valor |
|-------|-------|
| **Categoría** | AUTH_ERROR |
| **Código** | `AUTH_INVALID_CREDENTIALS` |
| **technicalMessage** | "ETECSA rejected credentials: invalid username or password" |
| **userMessage** | "Las credenciales son incorrectas." |
| **recommendedAction** | "Verifica tu usuario y contraseña. Si olvidaste tu contraseña, recupérala en el portal ETECSA." |
| **retryable** | false |
| **Causa común** | ETECSA devuelve HTML con `alert("El usuario o la contraseña son incorrectos.")` |
| **UI** | Toast error + shake animation en input de contraseña |
| **Log level** | INFO (no es bug del sistema, es error de usuario) |

#### AUTH_RATE_LIMITED

| Campo | Valor |
|-------|-------|
| **Categoría** | AUTH_ERROR |
| **Código** | `AUTH_RATE_LIMITED` |
| **technicalMessage** | "ETECSA rate limit triggered" |
| **userMessage** | "ETECSA ha limitado los intentos." |
| **recommendedAction** | "Espera unos minutos antes de intentar de nuevo. Si el problema persiste, contacta a ETECSA." |
| **retryable** | true (con cooldown de 60s) |
| **Causa común** | ETECSA devuelve `alert("Usted a realizado muchos intentos.")` |
| **UI** | Toast warning + botón "Conectar" deshabilitado por 60s |
| **Log level** | WARN |

#### AUTH_ACCOUNT_BLOCKED

| Campo | Valor |
|-------|-------|
| **Categoría** | AUTH_ERROR |
| **Código** | `AUTH_ACCOUNT_BLOCKED` |
| **technicalMessage** | "ETECSA account is blocked" |
| **userMessage** | "La cuenta está bloqueada." |
| **recommendedAction** | "Contacta a ETECSA para desbloquear tu cuenta." |
| **retryable** | false |
| **Causa común** | ETECSA devuelve `alert("La cuenta se encuentra bloqueada.")` |
| **UI** | Toast error persistente + sugerencia de contacto |
| **Log level** | WARN |

#### AUTH_UNKNOWN_FAILURE

| Campo | Valor |
|-------|-------|
| **Categoría** | AUTH_ERROR |
| **Código** | `AUTH_UNKNOWN_FAILURE` |
| **technicalMessage** | "ETECSA returned unrecognized auth failure alert: {alertMessage}" |
| **userMessage** | "No se pudo iniciar sesión." |
| **recommendedAction** | "Intenta de nuevo. Si el problema persiste, revisa Developer Mode para más detalles." |
| **retryable** | true |
| **Causa común** | ETECSA devuelve alerta desconocida no mapeada |
| **UI** | Toast error + link "Ver Developer Mode" |
| **Log level** | ERROR |

### 2.2 SESSION_ERROR

#### SESSION_EXPIRED

| Campo | Valor |
|-------|-------|
| **Categoría** | SESSION_ERROR |
| **Código** | `SESSION_EXPIRED` |
| **technicalMessage** | "ETECSA session has expired" |
| **userMessage** | "La sesión ha expirado." |
| **recommendedAction** | "ETECSA cerró la sesión. Puedes reconectar manualmente." |
| **retryable** | true |
| **Causa común** | ETECSA cerró sesión por inactividad (timeout servidor) |
| **UI** | Banner warning + botón "Reconectar" |
| **Log level** | INFO |

#### SESSION_IN_USE

| Campo | Valor |
|-------|-------|
| **Categoría** | SESSION_ERROR |
| **Código** | `SESSION_IN_USE` |
| **technicalMessage** | "ETECSA reports account has active session on another device" |
| **userMessage** | "La cuenta tiene sesión activa en otro dispositivo." |
| **recommendedAction** | "Puedes forzar el cierre remoto de la otra sesión para conectar aquí." |
| **retryable** | false (requiere acción del usuario) |
| **Causa común** | ETECSA devuelve `alert("El usuario ya tiene una sesión activa.")` |
| **UI** | Dialog de confirmación: "¿Forzar cierre remoto?" |
| **Log level** | INFO |

#### SESSION_NOT_FOUND

| Campo | Valor |
|-------|-------|
| **Categoría** | SESSION_ERROR |
| **Código** | `SESSION_NOT_FOUND` |
| **technicalMessage** | "No active session in storage" |
| **userMessage** | "No hay sesión activa." |
| **recommendedAction** | "Conecta una cuenta primero." |
| **retryable** | false |
| **Causa común** | Se intentó logout sin sesión activa |
| **UI** | (silencioso en logout — se trata como éxito) |
| **Log level** | DEBUG |

#### SESSION_ALREADY_ACTIVE

| Campo | Valor |
|-------|-------|
| **Categoría** | SESSION_ERROR |
| **Código** | `SESSION_ALREADY_ACTIVE` |
| **technicalMessage** | "Cannot login: session already active for account {accountId}" |
| **userMessage** | "Ya hay una sesión activa." |
| **recommendedAction** | "Desconecta la sesión actual antes de iniciar una nueva." |
| **retryable** | false |
| **Causa común** | Se intentó login con sesión ya activa |
| **UI** | Toast info + botón "Desconectar y reconectar" |
| **Log level** | INFO |

### 2.3 NETWORK_ERROR

#### NETWORK_TIMEOUT

| Campo | Valor |
|-------|-------|
| **Categoría** | NETWORK_ERROR |
| **Código** | `NETWORK_TIMEOUT` |
| **technicalMessage** | "Request to {url} timed out after {timeoutMs}ms" |
| **userMessage** | "La conexión con ETECSA tardó demasiado." |
| **recommendedAction** | "Verifica tu conexión a internet e inténtalo de nuevo." |
| **retryable** | true |
| **Causa común** | fetch timeout (15s default) |
| **UI** | Toast error con botón "Reintentar" |
| **Log level** | WARN |

#### NETWORK_DNS

| Campo | Valor |
|-------|-------|
| **Categoría** | NETWORK_ERROR |
| **Código** | `NETWORK_DNS` |
| **technicalMessage** | "DNS resolution failed for {hostname}" |
| **userMessage** | "No se pudo resolver el servidor ETECSA." |
| **recommendedAction** | "Verifica tu conexión WiFi Nauta y vuelve a intentarlo." |
| **retryable** | true |
| **Causa común** | DNS lookup failure |
| **UI** | Toast error con botón "Reintentar" |
| **Log level** | WARN |

#### NETWORK_OFFLINE

| Campo | Valor |
|-------|-------|
| **Categoría** | NETWORK_ERROR |
| **Código** | `NETWORK_OFFLINE` |
| **technicalMessage** | "Device is offline: cannot reach ETECSA" |
| **userMessage** | "Sin conexión con ETECSA." |
| **recommendedAction** | "Conéctate a una red WiFi Nauta para usar esta función." |
| **retryable** | false (hasta que vuelva la conexión) |
| **Causa común** | ConnectionMonitor detecta OFFLINE |
| **UI** | Banner warning persistente + botones ETECSA deshabilitados |
| **Log level** | INFO |

#### PORTAL_UNREACHABLE

| Campo | Valor |
|-------|-------|
| **Categoría** | NETWORK_ERROR |
| **Código** | `PORTAL_UNREACHABLE` |
| **technicalMessage** | "ETECSA portal unreachable at secure.etecsa.net:8443" |
| **userMessage** | "El portal ETECSA no responde." |
| **recommendedAction** | "ETECSA podría estar teniendo problemas. Inténtalo más tarde." |
| **retryable** | true |
| **Causa común** | Red existe pero ETECSA caído |
| **UI** | Toast error con botón "Reintentar" |
| **Log level** | WARN |

### 2.4 CONNECTOR_ERROR

#### CONNECTOR_PARSER_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | CONNECTOR_ERROR |
| **Código** | `CONNECTOR_PARSER_FAILED` |
| **technicalMessage** | "All strategies failed to parse ETECSA response. HTML structure may have changed." |
| **userMessage** | "El portal ETECSA ha cambiado." |
| **recommendedAction** | "NEXA NautaX no puede interpretar la respuesta de ETECSA. Revisa Developer Mode para más detalles o espera una actualización." |
| **retryable** | false |
| **Causa común** | HTML structure cambió y todas las strategies fallaron |
| **UI** | Toast error persistente + link "Ver Developer Mode" |
| **Log level** | ERROR |
| **Acción del sistema** | Publicar `CONNECTOR_DEGRADED` event |

#### CONNECTOR_CSRF_MISSING

| Campo | Valor |
|-------|-------|
| **Categoría** | CONNECTOR_ERROR |
| **Código** | `CONNECTOR_CSRF_MISSING` |
| **technicalMessage** | "CSRF token (CSRFHW) not found in login form" |
| **userMessage** | "Error al leer el formulario de ETECSA." |
| **recommendedAction** | "Intenta de nuevo. Si el problema persiste, el portal ETECSA puede haber cambiado." |
| **retryable** | true |
| **Causa común** | Form inicial no contiene input CSRFHW |
| **UI** | Toast error con botón "Reintentar" |
| **Log level** | WARN |

#### CONNECTOR_ATTRIBUTE_UUID_MISSING

| Campo | Valor |
|-------|-------|
| **Categoría** | CONNECTOR_ERROR |
| **Código** | `CONNECTOR_ATTRIBUTE_UUID_MISSING` |
| **technicalMessage** | "ATTRIBUTE_UUID not found in login response" |
| **userMessage** | "No se pudo completar el inicio de sesión." |
| **recommendedAction** | "ETECSA respondió de forma inesperada. Intenta de nuevo." |
| **retryable** | true |
| **Causa común** | Login POST respuesta no contiene ATTRIBUTE_UUID (puede ser fallo silencioso de auth) |
| **UI** | Toast error con botón "Reintentar" |
| **Log level** | WARN |

#### CONNECTOR_DEGRADED

| Campo | Valor |
|-------|-------|
| **Categoría** | CONNECTOR_ERROR |
| **Código** | `CONNECTOR_DEGRADED` |
| **technicalMessage** | "Connector degraded: {consecutiveFailures} consecutive failures" |
| **userMessage** | "El connector ETECSA está experimentando problemas." |
| **recommendedAction** | "Algunas funciones pueden no estar disponibles. Revisa Developer Mode para más detalles." |
| **retryable** | true (auto-recuperación) |
| **Causa común** | 3 fallos consecutivos del connector |
| **UI** | Banner warning discreto en SidePanel header |
| **Log level** | WARN |
| **Acción del sistema** | Tras 1 éxito, publicar `CONNECTOR_RECOVERED` (no error) |

### 2.5 BALANCE_ERROR

#### BALANCE_ZERO

| Campo | Valor |
|-------|-------|
| **Categoría** | BALANCE_ERROR |
| **Código** | `BALANCE_ZERO` |
| **technicalMessage** | "Account balance is zero" |
| **userMessage** | "Saldo insuficiente." |
| **recommendedAction** | "Recarga tu cuenta Nauta en el portal ETECSA o cambia a otra cuenta." |
| **retryable** | false (requiere acción del usuario) |
| **Causa común** | ETECSA devuelve alert "No existen saldos suficientes en la cuenta." |
| **UI** | Toast error + sugerencia "Cambiar cuenta" |
| **Log level** | INFO |

#### BALANCE_UNAVAILABLE

| Campo | Valor |
|-------|-------|
| **Categoría** | BALANCE_ERROR |
| **Código** | `BALANCE_UNAVAILABLE` |
| **technicalMessage** | "Cannot fetch balance: {cause}" |
| **userMessage** | "No se pudo obtener el saldo." |
| **recommendedAction** | "Revisa Developer Mode para más detalles. El saldo se actualizará en el próximo intento." |
| **retryable** | true |
| **Causa común** | Parser falló o HTTP error al consultar saldo |
| **UI** | Toast warning discreto + saldo muestra "—" |
| **Log level** | WARN |

### 2.6 STORAGE_ERROR

#### STORAGE_WRITE_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | STORAGE_ERROR |
| **Código** | `STORAGE_WRITE_FAILED` |
| **technicalMessage** | "Failed to write to chrome.storage: {cause}" |
| **userMessage** | "No se pudieron guardar los datos." |
| **recommendedAction** | "Intenta de nuevo. Si el problema persiste, libera espacio en el navegador." |
| **retryable** | true |
| **Causa común** | chrome.storage.set lanza excepción (quota, etc) |
| **UI** | Toast error |
| **Log level** | ERROR |

#### STORAGE_READ_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | STORAGE_ERROR |
| **Código** | `STORAGE_READ_FAILED` |
| **technicalMessage** | "Failed to read from chrome.storage: {cause}" |
| **userMessage** | "No se pudieron leer los datos." |
| **recommendedAction** | "Reinicia la extensión. Si el problema persiste, los datos pueden estar corruptos." |
| **retryable** | true |
| **Causa común** | chrome.storage.get lanza excepción |
| **UI** | Toast error + ofrecer "Restablecer extensión" |
| **Log level** | ERROR |

#### STORAGE_FULL

| Campo | Valor |
|-------|-------|
| **Categoría** | STORAGE_ERROR |
| **Código** | `STORAGE_FULL` |
| **technicalMessage** | "chrome.storage quota exceeded" |
| **userMessage** | "Espacio de almacenamiento lleno." |
| **recommendedAction** | "Limpia logs o historial desde Developer Mode o Settings." |
| **retryable** | false (requiere limpieza) |
| **Causa común** | chrome.storage.local excede 10 MB |
| **UI** | Toast error persistente + link "Limpiar datos" |
| **Log level** | ERROR |

#### STORAGE_CORRUPT

| Campo | Valor |
|-------|-------|
| **Categoría** | STORAGE_ERROR |
| **Código** | `STORAGE_CORRUPT` |
| **technicalMessage** | "Storage data corrupt: Zod validation failed for {key}" |
| **userMessage** | "Los datos están corruptos." |
| **recommendedAction** | "Restablece la extensión. Se perderán los datos corruptos." |
| **retryable** | false |
| **Causa común** | Zod schema validation falla al leer |
| **UI** | Pantalla de error fatal + botón "Restablecer" |
| **Log level** | FATAL |

### 2.7 CRYPTO_ERROR

#### CRYPTO_INVALID_MASTER_PASSWORD

| Campo | Valor |
|-------|-------|
| **Categoría** | CRYPTO_ERROR |
| **Código** | `CRYPTO_INVALID_MASTER_PASSWORD` |
| **technicalMessage** | "Master password verification failed: verifier mismatch" |
| **userMessage** | "Contraseña maestra incorrecta." |
| **recommendedAction** | "Verifica tu contraseña maestra. Si la olvidaste, puedes restablecer la extensión (se perderán los datos)." |
| **retryable** | true (con cooldown tras 3 fallos) |
| **Causa común** | PBKDF2 derivación no produce llave que descifre verifier |
| **UI** | Input shake + toast error + cooldown tras 3 fallos |
| **Log level** | WARN |

#### CRYPTO_NOT_INITIALIZED

| Campo | Valor |
|-------|-------|
| **Categoría** | CRYPTO_ERROR |
| **Código** | `CRYPTO_NOT_INITIALIZED` |
| **technicalMessage** | "CryptoService not initialized: master password not set" |
| **userMessage** | "Cifrado no configurado." |
| **recommendedAction** | "Completa la configuración inicial creando una contraseña maestra." |
| **retryable** | false |
| **Causa común** | Se intentó operación antes de onboarding |
| **UI** | Redirect a Onboarding flow |
| **Log level** | WARN |

#### CRYPTO_LOCKED

| Campo | Valor |
|-------|-------|
| **Categoría** | CRYPTO_ERROR |
| **Código** | `CRYPTO_LOCKED` |
| **technicalMessage** | "CryptoService is locked: master password required" |
| **userMessage** | "Extensión bloqueada." |
| **recommendedAction** | "Ingresa tu contraseña maestra para desbloquear." |
| **retryable** | false (requiere acción del usuario) |
| **Causa común** | Se intentó operación sin unlock |
| **UI** | Redirect a Unlock screen |
| **Log level** | INFO |

#### CRYPTO_DECRYPT_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | CRYPTO_ERROR |
| **Código** | `CRYPTO_DECRYPT_FAILED` |
| **technicalMessage** | "AES-GCM decryption failed: {cause}" |
| **userMessage** | "No se pudo descifrar la credencial." |
| **recommendedAction** | "La credencial puede estar corrupta. Edita la cuenta para volver a ingresarla." |
| **retryable** | false |
| **Causa común** | Datos corruptos, llave incorrecta, IV inválido |
| **UI** | Toast error + sugerencia "Editar cuenta" |
| **Log level** | ERROR |

#### CRYPTO_ENCRYPT_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | CRYPTO_ERROR |
| **Código** | `CRYPTO_ENCRYPT_FAILED` |
| **technicalMessage** | "AES-GCM encryption failed: {cause}" |
| **userMessage** | "No se pudo cifrar la credencial." |
| **recommendedAction** | "Intenta de nuevo. Si el problema persiste, reinicia la extensión." |
| **retryable** | true |
| **Causa común** | Web Crypto API error |
| **UI** | Toast error |
| **Log level** | ERROR |

### 2.8 SCHEDULER_ERROR

#### SCHEDULER_TASK_NOT_FOUND

| Campo | Valor |
|-------|-------|
| **Categoría** | SCHEDULER_ERROR |
| **Código** | `SCHEDULER_TASK_NOT_FOUND` |
| **technicalMessage** | "Scheduler task {taskId} not found" |
| **userMessage** | "Programación no encontrada." |
| **recommendedAction** | "La tarea puede haber sido cancelada. Refresca la lista." |
| **retryable** | false |
| **Causa común** | Se intentó cancelar/ejecutar tarea que ya no existe |
| **UI** | (silencioso — refrescar UI) |
| **Log level** | DEBUG |

#### SCHEDULER_INVALID_TRIGGER

| Campo | Valor |
|-------|-------|
| **Categoría** | SCHEDULER_ERROR |
| **Código** | `SCHEDULER_INVALID_TRIGGER` |
| **technicalMessage** | "Invalid scheduler trigger: {details}" |
| **userMessage** | "Configuración de programación inválida." |
| **recommendedAction** | "Verifica los valores ingresados." |
| **retryable** | false |
| **Causa común** | Trigger Zod validation falla |
| **UI** | Toast error + inline errors en form |
| **Log level** | WARN |

### 2.9 VALIDATION_ERROR

#### VALIDATION_FAILED

| Campo | Valor |
|-------|-------|
| **Categoría** | VALIDATION_ERROR |
| **Código** | `VALIDATION_FAILED` |
| **technicalMessage** | "Validation failed: {details}" |
| **userMessage** | "Datos inválidos." |
| **recommendedAction** | "Revisa los campos marcados en rojo." |
| **retryable** | false |
| **Causa común** | Zod schema validation falla en input de UI |
| **UI** | Inline errors en form + toast error sutil |
| **Log level** | INFO |

### 2.10 UNKNOWN_ERROR

#### UNKNOWN_ERROR

| Campo | Valor |
|-------|-------|
| **Categoría** | UNKNOWN_ERROR |
| **Código** | `UNKNOWN_ERROR` |
| **technicalMessage** | "Unexpected error: {cause}" |
| **userMessage** | "Ocurrió un error inesperado." |
| **recommendedAction** | "Intenta de nuevo. Si el problema persiste, revisa Developer Mode o reporta el problema." |
| **retryable** | true |
| **Causa común** | Cualquier excepción no manejada |
| **UI** | Toast error + link "Ver Developer Mode" |
| **Log level** | ERROR |

---

## 3. Helpers de Construcción

### 3.1 Factory functions

```typescript
// src/types/errors.ts

function makeError(
  code: NexaErrorCode,
  technicalMessage: string,
  options?: {
    cause?: unknown;
    traceId?: TraceId;
  }
): NexaError {
  const catalog = ERROR_CATALOG[code];
  return {
    code,
    category: catalog.category,
    technicalMessage,
    userMessage: catalog.userMessage,
    recommendedAction: catalog.recommendedAction,
    retryable: catalog.retryable,
    cause: options?.cause,
    timestamp: Date.now(),
    traceId: options?.traceId,
  };
}
```

### 3.2 Catálogo estático

```typescript
const ERROR_CATALOG: Readonly<Record<NexaErrorCode, {
  category: NexaErrorCategory;
  userMessage: string;
  recommendedAction: string;
  retryable: boolean;
}>> = {
  AUTH_INVALID_CREDENTIALS: {
    category: 'AUTH_ERROR',
    userMessage: 'Las credenciales son incorrectas.',
    recommendedAction: 'Verifica tu usuario y contraseña. Si olvidaste tu contraseña, recupérala en el portal ETECSA.',
    retryable: false,
  },
  AUTH_RATE_LIMITED: {
    category: 'AUTH_ERROR',
    userMessage: 'ETECSA ha limitado los intentos.',
    recommendedAction: 'Espera unos minutos antes de intentar de nuevo.',
    retryable: true,
  },
  // ... todos los demás
};
```

### 3.3 Utilidades

```typescript
// Check si un error es de cierta categoría
function isCategory(error: NexaError, category: NexaErrorCategory): boolean {
  return error.category === category;
}

// Check si error es recoverable
function isRetryable(error: NexaError): boolean {
  return error.retryable;
}

// Wrap unknown error into NexaError
function toNexaError(unknown: unknown, traceId?: TraceId): NexaError {
  if (unknown instanceof Error) {
    return makeError('UNKNOWN_ERROR', unknown.message, { cause: unknown, traceId });
  }
  return makeError('UNKNOWN_ERROR', String(unknown), { traceId });
}
```

---

## 4. Comportamiento del UI por Categoría

### 4.1 Matriz UI

| Categoría | Toast variant | Auto-dismiss | Banner | Modal |
|-----------|--------------|--------------|--------|-------|
| AUTH_ERROR | error | no | no | sí (SESSION_IN_USE) |
| SESSION_ERROR | warning | 8s | sí (SESSION_EXPIRED) | no |
| NETWORK_ERROR | error | no | sí (NETWORK_OFFLINE) | no |
| CONNECTOR_ERROR | error | no | sí (CONNECTOR_DEGRADED) | no |
| BALANCE_ERROR | error | no | no | no |
| STORAGE_ERROR | error | no | sí (STORAGE_FULL) | sí (STORAGE_CORRUPT) |
| CRYPTO_ERROR | error | no | no | sí (CRYPTO_LOCKED redirect) |
| SCHEDULER_ERROR | info | 5s | no | no |
| VALIDATION_ERROR | info | 5s | no | no |
| UNKNOWN_ERROR | error | no | no | no |

### 4.2 Reglas adicionales

- `retryable: true` → toast debe tener botón "Reintentar" si aplica.
- `retryable: false` → toast debe tener botón "Cerrar" o acción específica.
- Si `traceId` presente → toast puede tener link "Ver en Developer Mode" que abre el trace.
- Errores FATALES (STORAGE_CORRUPT) → pantalla de error full-screen, no toast.

---

## 5. Mapeo ETECSA → NexaError

### 5.1 Mensajes español → código

```typescript
// src/connectors/etecsa/errors/errorCatalog.ts

interface CatalogEntry {
  readonly code: NexaErrorCode;
  readonly patterns: readonly string[];      // strings normalizados (sin acentos, lowercase)
  readonly maxDistance: number;              // tolerancia Levenshtein
}

const ERROR_CATALOG: readonly CatalogEntry[] = [
  {
    code: 'AUTH_INVALID_CREDENTIALS',
    patterns: ['usuario o la contrasena son incorrectos'],
    maxDistance: 3,
  },
  {
    code: 'AUTH_RATE_LIMITED',
    patterns: ['usted a realizado muchos intentos', 'usted ha realizado muchos intentos'],
    maxDistance: 2,
  },
  {
    code: 'BALANCE_ZERO',
    patterns: ['no existen saldos suficientes en la cuenta'],
    maxDistance: 3,
  },
  {
    code: 'AUTH_ACCOUNT_BLOCKED',
    patterns: ['cuenta se encuentra bloqueada'],
    maxDistance: 2,
  },
  {
    code: 'SESSION_EXPIRED',
    patterns: ['sesion ha expirado'],
    maxDistance: 2,
  },
  {
    code: 'SESSION_IN_USE',
    patterns: ['usuario ya tiene una sesion activa', 'ya tiene una sesion activa'],
    maxDistance: 3,
  },
];
```

### 5.2 Normalización

```typescript
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  // implementation standard
}

function findErrorByMessage(rawMessage: string): NexaErrorCode | null {
  const normalized = normalize(rawMessage);
  for (const entry of ERROR_CATALOG) {
    for (const pattern of entry.patterns) {
      const distance = levenshtein(normalized, pattern);
      if (distance <= entry.maxDistance) {
        return entry.code;
      }
    }
  }
  return null;
}
```

---

## 6. Rate Limiting Local

### 6.1 Crypto unlock

| Intentos fallidos | Cooldown |
|-------------------|----------|
| 1-2 | sin cooldown |
| 3-5 | 30s cooldown |
| 6-8 | 5 min cooldown |
| 9+ | 30 min cooldown |

```typescript
// En CryptoService
private failCount = 0;
private cooldownUntil = 0;

async unlock(masterPassword: string): Promise<Result<void, NexaError>> {
  if (Date.now() < this.cooldownUntil) {
    return Err(makeError('CRYPTO_INVALID_MASTER_PASSWORD', 'In cooldown'));
  }
  
  // ... try unlock
  
  if (!success) {
    this.failCount += 1;
    if (this.failCount === 3) this.cooldownUntil = Date.now() + 30_000;
    else if (this.failCount === 6) this.cooldownUntil = Date.now() + 300_000;
    else if (this.failCount >= 9) this.cooldownUntil = Date.now() + 1_800_000;
    return Err(makeError('CRYPTO_INVALID_MASTER_PASSWORD', 'Invalid password'));
  }
  
  this.failCount = 0;
  this.cooldownUntil = 0;
  return Ok(void);
}
```

### 6.2 Login ETECSA

- Respetar `AUTH_RATE_LIMITED` de ETECSA.
- Tras recibir rate limit, no reintentar por 60s (no configurable — es política ETECSA).
- Auto-reconnect respeta esto automáticamente.

### 6.3 Connector operations

- Tras `CONNECTOR_DEGRADED` (3 fallos consecutivos), reducir frecuencia de reintentos.
- No hay cooldown duro — el usuario siempre puede forzar operación manual.

---

## 7. Logging de Errores

### 7.1 Niveles por código

```typescript
const LOG_LEVEL_BY_CODE: Record<NexaErrorCode, LogLevel> = {
  // Errores de usuario (no bugs)
  AUTH_INVALID_CREDENTIALS: 'INFO',
  AUTH_RATE_LIMITED: 'WARN',
  AUTH_ACCOUNT_BLOCKED: 'WARN',
  BALANCE_ZERO: 'INFO',
  SESSION_EXPIRED: 'INFO',
  SESSION_IN_USE: 'INFO',
  SESSION_NOT_FOUND: 'DEBUG',
  SESSION_ALREADY_ACTIVE: 'INFO',
  NETWORK_OFFLINE: 'INFO',
  
  // Errores recuperables
  NETWORK_TIMEOUT: 'WARN',
  NETWORK_DNS: 'WARN',
  PORTAL_UNREACHABLE: 'WARN',
  CONNECTOR_CSRF_MISSING: 'WARN',
  CONNECTOR_ATTRIBUTE_UUID_MISSING: 'WARN',
  CONNECTOR_DEGRADED: 'WARN',
  BALANCE_UNAVAILABLE: 'WARN',
  CRYPTO_INVALID_MASTER_PASSWORD: 'WARN',
  CRYPTO_ENCRYPT_FAILED: 'ERROR',
  STORAGE_WRITE_FAILED: 'ERROR',
  STORAGE_READ_FAILED: 'ERROR',
  STORAGE_FULL: 'ERROR',
  
  // Errores del sistema
  AUTH_UNKNOWN_FAILURE: 'ERROR',
  CONNECTOR_PARSER_FAILED: 'ERROR',
  CRYPTO_DECRYPT_FAILED: 'ERROR',
  CRYPTO_NOT_INITIALIZED: 'WARN',
  CRYPTO_LOCKED: 'INFO',
  SCHEDULER_TASK_NOT_FOUND: 'DEBUG',
  SCHEDULER_INVALID_TRIGGER: 'WARN',
  VALIDATION_FAILED: 'INFO',
  UNKNOWN_ERROR: 'ERROR',
  
  // Fatales
  STORAGE_CORRUPT: 'FATAL',
};
```

### 7.2 Sanitización

Antes de loggear un error, sanitizar `technicalMessage` y `cause`:

- Reemplazar passwords, tokens, CSRFHW, ATTRIBUTE_UUID, JSESSIONID, emails, IPs.
- Si `cause` es un Error de fetch, extraer solo `message` y `name`, no `stack`.

### 7.3 Trace ID

Todo error debe tener `traceId` si fue generado durante una operación multi-step. El `SessionManager.startTrace()` propaga el traceId a través del contexto.

---

## 8. Recuperación Automática

### 8.1 Política por código

| Código | Auto-retry | Acción automática |
|--------|-----------|-------------------|
| NETWORK_TIMEOUT | sí (3x con backoff) | HttpClient retry policy |
| NETWORK_DNS | sí (3x con backoff) | HttpClient retry policy |
| PORTAL_UNREACHABLE | sí (3x con backoff) | HttpClient retry policy |
| CONNECTOR_CSRF_MISSING | sí (1x — re-fetch form) | KnownEndpointStrategy |
| CONNECTOR_ATTRIBUTE_UUID_MISSING | no | Parser fallback a siguiente strategy |
| CONNECTOR_PARSER_FAILED | no | Strategy chain ya intentó todas |
| AUTH_RATE_LIMITED | no | Espera cooldown de 60s |
| AUTH_INVALID_CREDENTIALS | no | Error de usuario |
| BALANCE_ZERO | no | Error de usuario |
| SESSION_EXPIRED | sí (si reconnectPolicy.enabled) | SessionManager auto-reconnect |
| SESSION_IN_USE | no | Requiere acción del usuario |
| NETWORK_OFFLINE | no | Esperar ConnectionMonitor |
| CRYPTO_LOCKED | no | Redirect a unlock screen |
| Otros | no | Mostrar error al usuario |

### 8.2 Backoff policy

```typescript
const RETRY_DELAYS_MS = [500, 1000, 2000];  // 3 retries

async function withRetry<T>(
  operation: () => Promise<Result<T, NexaError>>,
  retries: number = 3
): Promise<Result<T, NexaError>> {
  let lastError: NexaError;
  for (let attempt = 0; attempt < retries; attempt++) {
    const result = await operation();
    if (result.ok) return result;
    lastError = result.error;
    if (!result.error.retryable) return result;
    if (attempt < retries - 1) {
      await sleep(RETRY_DELAYS_MS[attempt] ?? 2000);
    }
  }
  return { ok: false, error: lastError! };
}
```

---

## 9. Tests de Errores

### 9.1 Cobertura requerida (Fase 8)

- Cada `NexaErrorCode` tiene al menos un test que verifica:
  - `makeError()` produce estructura correcta.
  - `userMessage` y `recommendedAction` no están vacíos.
  - `retryable` es consistente con el catálogo.
- `errorMapper` tests:
  - Cada mensaje español del catálogo mapea al código correcto.
  - Typos conocidos (ej: "a realizado") mapean correctamente.
  - Mensajes desconocidos mapean a `AUTH_UNKNOWN_FAILURE` o `UNKNOWN_ERROR`.
- `withRetry` tests:
  - Operación exitosa al primer intento → no hay delay.
  - Operación falla 2 veces y éxito al 3ero → 2 delays.
  - Operación falla 3 veces → retorna error después de 3 retries.
  - Operación con `retryable: false` → no hay retry.

### 9.2 Tests E2E

- Login con credenciales inválidas → toast correcto.
- Login sin conexión → banner offline.
- Login rate limited → toast + cooldown.
- Logout cuando sesión ya expiró → éxito silencioso.
- Crypto unlock con 3 fallos → cooldown.
- Backup import corrupto → error específico.

---

## 10. Pendientes para Fases siguientes

### Fase 5
- Implementar `src/types/errors.ts` con todos los tipos.
- Implementar `ERROR_CATALOG` en `src/types/errorCatalog.ts`.
- Implementar `makeError()` factory.
- Implementar `toNexaError()` wrapper.

### Fase 6
- Implementar `errorCatalog.ts` del connector (mensajes español → código).
- Implementar `errorMapper.ts` que usa el catálogo.
- Implementar `withRetry()` en HttpClient.

### Fase 7
- UI consume `NexaError.userMessage` y `recommendedAction` para toasts.
- UI decide banner vs toast vs modal según categoría.
- Developer Mode muestra `technicalMessage` y `traceId`.

### Fase 8
- Tests unitarios del catálogo.
- Tests E2E de flujos de error.

---

**Fin del Documento 4.**
**Fin de la Fase 4.**

Esperando validación del usuario para iniciar Fase 5 (Implementación del Núcleo de la Extensión).
