# NEXA NautaX — Connector Architecture Proposal

**Fase:** 1
**Documento:** 2 de 3
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22
**Referencia:** Documento 1 (`01-etecsa-connector-research-report.md`) — Endpoints, flujos y antipatrones.

> Este documento define la arquitectura del ETECSA Connector Layer. **No contiene código funcional** — solo interfaces, tipos, diagramas y contratos. La implementación real se realiza en la Fase 6.

---

## 1. Arquitectura Conceptual

```
┌─────────────────────────────────────────────────────────────────┐
│                       UI (Popup / SidePanel)                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Llamada a servicios
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Services Layer                    │
│  SessionManager · AccountManager · SchedulerEngine · ...        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Llamada al connector
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ETECSA Connector (Facade)                      │
│   EtecsaConnector — orquesta strategies, expone API estable     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Delega a strategy chain
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
   │  HTTP Client    │ │  Parser Chain   │ │  Error Mapper   │
   │  (fetch wrap)   │ │  (DOM + regex)  │ │  (msg → code)   │
   └────────┬────────┘ └────────┬────────┘ └─────────────────┘
            │                   │
            ▼                   ▼
   ┌─────────────────────────────────────────────┐
   │            Strategy Chain                    │
   │  1. KnownEndpointStrategy (primary)         │
   │  2. DiscoveredEndpointStrategy              │
   │  3. ScrapingDomStrategy                     │
   │  4. ScrapingRegexStrategy                   │
   │  5. ManualFallbackStrategy                  │
   └────────────────────┬────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   ETECSA Portal   │
              │  secure.etecsa.   │
              │   net:8443        │
              └──────────────────┘
```

### Principios rectores

1. **El Connector es la única frontera con ETECSA**. Ningún otro módulo (UI, services, store) puede hacer `fetch` a `secure.etecsa.net` directamente.
2. **Result<T, E> sobre throws**. Toda función del connector devuelve un `Result`. Los services deciden qué hacer con errores.
3. **Strategies intercambiables**. Si ETECSA cambia su HTML, agregamos una nueva strategy sin tocar el resto del sistema.
4. **Health reporting transversal**. Cada strategy reporta éxito/fallo con metadatos al `DiagnosticEngine` para Developer Mode.
5. **Idempotencia**. Las operaciones pueden repetirse tras un reinicio del SW sin efectos secundarios.

---

## 2. Tipos y Contratos

### 2.1 Branded types (defensa contra bugs de refactoring)

```typescript
// src/connectors/etecsa/types.ts

type AccountId = string & { readonly __brand: 'AccountId' };
type SessionId = string & { readonly __brand: 'SessionId' };
type CsrfToken = string & { readonly __brand: 'CsrfToken' };
type AttributeUuid = string & { readonly __brand: 'AttributeUuid' };
type WlanUserIp = string & { readonly __brand: 'WlanUserIp' };
```

### 2.2 SessionData — la entidad central del connector

```typescript
// Inmutable. Es lo que se persiste en chrome.storage.local (cifrado).
interface SessionData {
  readonly accountId: AccountId;
  readonly username: string;
  readonly csrfToken: CsrfToken;
  readonly attributeUuid: AttributeUuid;
  readonly wlanUserIp: WlanUserIp;
  readonly loggerId: string;
  readonly startedAt: number;          // epoch ms
  readonly cookies: Readonly<Record<string, string>>;  // serializable
  readonly lastSync: number;           // epoch ms — último sync con ETECSA
}
```

### 2.3 Result type

```typescript
type Result<T, E = EtecsaError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

### 2.4 EtecsaError jerarquía

```typescript
type EtecsaErrorCode =
  // Auth
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_ACCOUNT_BLOCKED'
  | 'AUTH_UNKNOWN_FAILURE'
  // Session
  | 'SESSION_EXPIRED'
  | 'SESSION_IN_USE'
  | 'SESSION_NOT_FOUND'
  // Network
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_DNS'
  | 'NETWORK_OFFLINE'           // sin conexión a ETECSA (D07)
  | 'PORTAL_UNREACHABLE'
  // Connector
  | 'CONNECTOR_PARSER_FAILED'   // HTML cambió
  | 'CONNECTOR_CSRF_MISSING'
  | 'CONNECTOR_ATTRIBUTE_UUID_MISSING'
  // Balance / account
  | 'BALANCE_ZERO'
  // Unknown
  | 'UNKNOWN_ETECSA';

type EtecsaErrorCategory =
  | 'AUTH_ERROR'
  | 'SESSION_ERROR'
  | 'NETWORK_ERROR'
  | 'CONNECTOR_ERROR'
  | 'BALANCE_ERROR'
  | 'UNKNOWN_ERROR';

interface EtecsaError {
  readonly code: EtecsaErrorCode;
  readonly category: EtecsaErrorCategory;
  readonly technicalMessage: string;   // para Developer Mode
  readonly userMessage: string;        // ya traducido al español (D10 idioma)
  readonly recommendedAction: string;  // texto en español para UI
  readonly retryable: boolean;
  readonly cause?: unknown;
  readonly timestamp: number;
}
```

### 2.5 Contratos de operación

```typescript
interface LoginRequest {
  readonly username: string;
  readonly password: string;          // se mantiene solo en memoria; nunca se persiste
  readonly accountType: 'prepaid';    // D09: solo prepago en Fase 1
}

interface LoginResponse {
  readonly session: SessionData;
  readonly timeRemaining?: Duration;  // si la strategy pudo obtenerlo en el mismo flujo
}

interface BalanceResponse {
  readonly amount: number;
  readonly currency: 'CUP';
  readonly expiresAt?: number;        // epoch ms — fecha de bloqueo
  readonly lastUpdated: number;
}

interface TimeRemainingResponse {
  readonly remaining: Duration;
  readonly startedAt: number;
  readonly fetchedAt: number;
}

interface SessionInfoResponse {
  readonly session: SessionData;
  readonly timeRemaining?: Duration;
  readonly balance?: BalanceResponse;
}

interface CredentialsVerification {
  readonly valid: boolean;
  readonly balance?: BalanceResponse;
  readonly error?: EtecsaError;
}
```

### 2.6 Interfaz pública del Connector

```typescript
// src/connectors/etecsa/EtecsaConnector.ts

interface IEtecsaConnector {
  // —— Operaciones de conexión ——
  login(req: LoginRequest): Promise<Result<LoginResponse>>;

  logout(session: SessionData): Promise<Result<void>>;

  // —— Consultas de sesión activa ——
  getTimeRemaining(session: SessionData): Promise<Result<TimeRemainingResponse>>;

  getBalance(session: SessionData): Promise<Result<BalanceResponse>>;

  getSessionInfo(session: SessionData): Promise<Result<SessionInfoResponse>>;

  // —— Utilidades ——
  /** Verifica credenciales sin establecer sesión de internet (modo 2 de EtecsaQueryServlet). */
  verifyCredentials(req: LoginRequest): Promise<Result<CredentialsVerification>>;

  /** Probe de conectividad — devuelve el estado del portal cautivo. */
  probePortal(): Promise<Result<PortalStatus>>;

  // —— Health / Developer Mode ——
  getHealth(): ConnectorHealth;
}

type PortalStatus =
  | { kind: 'ONLINE'; captivePortal: false }                          // hay internet
  | { kind: 'CAPTIVE_PORTAL'; captivePortal: true }                  // ETECSA espera login
  | { kind: 'OFFLINE'; captivePortal: false; reason: string };        // no hay red

interface ConnectorHealth {
  readonly lastOperation: 'login' | 'logout' | 'balance' | 'time' | 'verify' | 'probe' | null;
  readonly lastSuccessAt: number | null;
  readonly lastError: EtecsaError | null;
  readonly currentStrategy: StrategyName;
  readonly consecutiveFailures: number;
}

type StrategyName =
  | 'KnownEndpoint'
  | 'DiscoveredEndpoint'
  | 'ScrapingDom'
  | 'ScrapingRegex'
  | 'ManualFallback';
```

---

## 3. Strategy Chain — Detalle

Cada operación (`login`, `logout`, etc.) pasa por la strategy chain. La primera strategy que retorna `ok: true` gana. Si todas fallan, se retorna el `EtecsaError` de la última strategy con la mayor información.

### 3.1 KnownEndpointStrategy (primary)

- Usa URLs hardcoded: `https://secure.etecsa.net:8443//LoginServlet`, etc.
- Usa selectores primarios: `form#formulario`, `input[name=CSRFHW]`, regex `ATTRIBUTE_UUID=(\w+)&CSRFHW=`.
- **Exitosa en >95% de los casos** (basado en consenso de los 11 repos relevantes).

### 3.2 DiscoveredEndpointStrategy

- Si la strategy 1 falla con `CONNECTOR_PARSER_FAILED`, esta strategy:
  1. Re-fetch del form inicial.
  2. Busca cualquier `<form method="post">` que contenga `input[type=password]`.
  3. Usa el `action` descubierto como URL de login.
  4. Cosecha TODOS los inputs hidden (no asume nombres específicos).
- Inspirado en `qvacall-cli/getLoginParameters()`.

### 3.3 ScrapingDomStrategy

- Si las strategies 1 y 2 fallan en el parseo de respuesta (no encuentran `ATTRIBUTE_UUID`), esta strategy:
  1. Parsea el HTML con `DOMParser`.
  2. Busca en todos los `<script>` bloques cualquier variable asignada estilo `var x = '...'` donde el valor tenga 32+ chars alfanum.
  3. Si encuentra un candidato, lo asigna como `attributeUuid` tentativo.
  4. Verifica haciendo una llamada `getTimeRemaining` con ese token; si responde 200, es válido.

### 3.4 ScrapingRegexStrategy

- Si el DOM no funciona, cae a regex crudo sobre el HTML.
- Mantiene un array de regex alternativos:
  ```typescript
  const ATTRIBUTE_UUID_PATTERNS = [
    /ATTRIBUTE_UUID=(\w+)&CSRFHW=/,
    /attribute_uuid=([a-f0-9]+)/i,
    /window\.__SESSION__\s*=\s*['"](\w+)['"]/,
  ];
  ```

### 3.5 ManualFallbackStrategy

- Si todas las strategies automáticas fallan:
  - Devuelve un `EtecsaError` con `code: 'CONNECTOR_PARSER_FAILED'` y `retryable: false`.
  - Marca `currentStrategy: 'ManualFallback'` en health.
  - Emite evento al NotificationEngine: "El portal ETECSA ha cambiado. Abre Developer Mode para más información."
  - NO lanza excepción, NO entra en loop infinito.

### 3.6 Selection policy

```typescript
// Pseudocódigo de la orquestación (no es código funcional)
async function executeWithChain<T>(
  operation: (strategy: Strategy) => Promise<Result<T>>
): Promise<Result<T>> {
  const strategies: Strategy[] = [
    new KnownEndpointStrategy(),
    new DiscoveredEndpointStrategy(),
    new ScrapingDomStrategy(),
    new ScrapingRegexStrategy(),
  ];

  let lastError: EtecsaError | null = null;

  for (const strategy of strategies) {
    const result = await operation(strategy);
    if (result.ok) {
      healthReporter.markSuccess(strategy.name);
      return result;
    }
    // Solo avanzar si el error es de tipo parser/connector
    // Errores AUTH o NETWORK no justifican probar otra strategy
    if (result.error.category === 'CONNECTOR_ERROR') {
      lastError = result.error;
      continue;
    }
    return result;  // error no recuperable, retornar inmediatamente
  }

  return { ok: false, error: lastError ?? unknownError() };
}
```

> **Decisión de arquitecto**: errores `AUTH_*`, `SESSION_*` y `NETWORK_*` no justifican probar otra strategy. Solo los `CONNECTOR_*` (HTML cambió, parser falló) activan la cadena.

---

## 4. HTTP Client interno

### 4.1 Justificación

No usamos `axios` ni `got` — son innecesarios en MV3 y añaden peso al bundle. `fetch` con un wrapper custom es suficiente.

### 4.2 Wrapper — contrato conceptual

```typescript
interface HttpClient {
  request<T>(
    url: string,
    options: RequestOptions
  ): Promise<HttpResponse<T>>;
}

interface RequestOptions {
  readonly method: 'GET' | 'POST';
  readonly body?: URLSearchParams | string;
  readonly headers?: Record<string, string>;
  readonly timeoutMs: number;        // default 15000
  readonly redirect: 'manual' | 'follow';  // manual para detectar captive portal
  readonly credentials: 'include';   // SIEMPRE include (cookies ETECSA)
}

interface HttpResponse<T> {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;                  // tipo definido por caller
  readonly finalUrl: string;         // tras redirects
  readonly timing: { dns: number; tcp: number; tls: number; ttfb: number; total: number };
}
```

### 4.3 Politica de retry

- Hasta 3 reintentos en errores de red (no HTTP 4xx/5xx).
- Backoff exponencial: 500ms, 1000ms, 2000ms.
- Sin retry en HTTP 200 con body inválido (eso es trabajo de la strategy chain).
- Sin retry en timeouts consecutivos (probablemente offline → D07).

---

## 5. Parser Layer

### 5.1 Separamos HTTP de parsing

```typescript
interface HtmlParser {
  extractLoginForm(html: string): Result<LoginFormFields>;
  extractAttributeUuid(html: string): Result<AttributeUuid>;
  extractAlertMessage(html: string): Result<string | null>;
  extractSessionInfo(html: string): Result<SessionInfoFields>;
}

interface LoginFormFields {
  readonly csrfToken: CsrfToken;
  readonly wlanUserIp: WlanUserIp;
  readonly loggerId: string;
  readonly gotopage: string;
  readonly successpage: string;
  readonly lang: string;
  readonly action: string;        // URL del form, normalmente //LoginServlet
}

interface SessionInfoFields {
  readonly balance?: number;
  readonly currency: 'CUP';
  readonly expiresAt?: number;
  readonly timeRemaining?: Duration;
}
```

### 5.2 Implementación

- Usa `DOMParser` (nativo del navegador, no requiere librería).
- Selector array por campo: si el primario falla, prueba alternativos.
- **No** usa `cheerio` (peso innecesario en MV3).
- **No** usa `jsdom` (no funciona bien en SW).
- Tests con fixtures HTML extraídos del corpus (ver §7).

---

## 6. Error Mapper

### 6.1 Mensajes ETECSA → códigos NEXA

```typescript
// src/connectors/etecsa/errorCatalog.ts

interface CatalogEntry {
  readonly code: EtecsaErrorCode;
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
    // ETECSA escribe "a realizado" (typo) — normalization lo cubre
    patterns: ['usted a realizado muchos intentos', 'usted ha realizado muchos intentos'],
    maxDistance: 2,
  },
  // ... resto del catálogo del Doc 1, §5
];
```

### 6.2 Mensajes en español para el usuario (D10)

```typescript
const USER_MESSAGES: Record<EtecsaErrorCode, { message: string; action: string }> = {
  AUTH_INVALID_CREDENTIALS: {
    message: 'Las credenciales son incorrectas.',
    action: 'Verifica tu usuario y contraseña.',
  },
  AUTH_RATE_LIMITED: {
    message: 'ETECSA ha limitado los intentos.',
    action: 'Espera unos minutos antes de intentar de nuevo.',
  },
  // ...
};
```

---

## 7. Fixture Corpus y Testing

### 7.1 Corpus de HTML

```
tests/
└── fixtures/
    └── etecsa-html/
        ├── login-form-success.html      # form inicial válido
        ├── login-form-no-csrf.html      # CSRFHW ausente (caso edge)
        ├── login-response-success.html  # respuesta con ATTRIBUTE_UUID
        ├── login-response-bad-creds.html
        ├── login-response-rate-limited.html
        ├── login-response-account-blocked.html
        ├── login-response-account-in-use.html
        ├── session-info-with-balance.html
        ├── session-info-no-balance.html
        ├── logout-response.html
        └── online-redirect.html         # respuesta 302 a online.do
```

### 7.2 Tests de regresión

- Cada parser se prueba contra todos los fixtures.
- Cada fixture tiene un caso esperado (snapshot).
- Si ETECSA cambia su HTML, agregamos un nuevo fixture sin romper los existentes.
- Pipeline CI (Fase 8): tests de fixtures corren en cada commit.

### 7.3 Healthcheck en runtime

- El connector mantiene un `HealthReport` que se actualiza tras cada operación.
- `getHealth()` devuelve el estado actual.
- Developer Mode muestra este reporte en tiempo real (Fase 7).

---

## 8. Mapeo a Decisiones Fase 0 (D01-D10)

| Decisión Fase 0 | Cómo se cumple en esta arquitectura |
|-----------------|--------------------------------------|
| **D01** Sin CAPTCHA | Connector no implementa flujo de CAPTCHA. Si detecta alert con texto "captcha" en tiempo de ejecución, retorna `UNKNOWN_ETECSA` con mensaje recomendando login asistido. |
| **D02** Conmutación (una activa) | `SessionData` tiene un único `accountId`. No hay sesiones paralelas. `verifyCredentials` permite probar credenciales sin establecer sesión. |
| **D03** Reconnect configurable | `EtecsaConnector` expone `probePortal()` que el `SessionManager` usa para detectar desconexión. El scheduler (Fase 4) aplica la política de la cuenta. |
| **D04** Master password | El connector nunca persiste credenciales — solo `SessionData` (que no contiene password). El `AccountManager` cifra `encryptedPassword` con AES-GCM usando llave derivada PBKDF2. |
| **D05** Cuatro temas | Sin impacto directo en el connector. |
| **D06** Web Store | Connector no requiere permisos especiales — `fetch` con `credentials: 'include'` y host_permissions para `secure.etecsa.net:8443`. Sin `cookies` permission. |
| **D07** Offline | `probePortal()` distingue `OFFLINE` (no hay red) de `PORTAL_UNREACHABLE` (red existe pero ETECSA no responde). `SessionManager` solo bloquea login cuando `OFFLINE`. |
| **D08** Solo logs locales | `DiagnosticEngine` recibe events del connector via `healthReporter`. Toda la información se queda en `chrome.storage.local`. El logger sanitiza tokens automáticamente. |
| **D09** Solo prepago | `LoginRequest.accountType: 'prepaid'`. Si se recibe `'postpaid'`, error `UNKNOWN_ETECSA` con mensaje "Tipo de cuenta no soportado en esta versión." |
| **D10** Notificaciones NEXA | Cuando el connector retorna error, el `SessionManager` emite un evento al `NotificationEngine` que muestra un Toast NEXA custom. El connector no conoce la UI. |

---

## 9. Diagrama de Dependencias

```
                       ┌──────────────────────┐
                       │  IEtecsaConnector     │  (interfaz pública)
                       └──────────┬───────────┘
                                  │ implements
                  ┌───────────────┴────────────────┐
                  │                                │
        ┌─────────▼──────────┐         ┌──────────▼──────────┐
        │  EtecsaConnector   │         │  MockEtecsaConnector│  (tests/dev)
        │  (Facade)          │         └─────────────────────┘
        └─────┬─────┬────────┘
              │     │
              │     │ uses
              │     ▼
              │  ┌──────────────────┐
              │  │  Strategy Chain  │
              │  │  (5 strategies)  │
              │  └────────┬─────────┘
              │           │
              │           ▼
              │  ┌──────────────────┐
              │  │   HtmlParser     │
              │  └────────┬─────────┘
              │           │
              ▼           ▼
        ┌──────────────────────┐
        │     HttpClient       │
        │  (fetch wrapper)     │
        └──────────┬───────────┘
                   │
                   ▼
              ┌─────────┐
              │  fetch  │  (browser API)
              └─────────┘
```

### Inversión de dependencias

- `EtecsaConnector` depende de **interfaces** (`HttpClient`, `HtmlParser`, `HealthReporter`), no de implementaciones concretas.
- En tests, se inyectan mocks.
- En runtime, se inyectan implementaciones reales.

---

## 10. HealthReporter — Contrato para Developer Mode

```typescript
interface HealthReporter {
  markSuccess(strategy: StrategyName, operation: string, timing: HttpTiming): void;
  markFailure(strategy: StrategyName, operation: string, error: EtecsaError): void;
  markFallback(strategy: StrategyName, operation: string): void;
  snapshot(): ConnectorHealth;
}

// Implementado por DiagnosticEngine (Fase 4).
// El connector recibe esta interfaz en su constructor (DI).
```

Cada evento del HealthReporter se persiste en `chrome.storage.local` bajo namespace `nexa.logs.connector` con tamaño máximo rotativo (Fase 4 define la política de retención).

---

## 11. Compatibilidad Futura

### 11.1 Nuevos conectores (NEXA Cloud, NEXA IPTV)

La interfaz `IEtecsaConnector` puede generalizarse a `IProviderConnector`:

```typescript
interface IProviderConnector<TSession, TOperations extends ProviderOperations> {
  // ...
}
```

Pero **no hacemos esto en Fase 1** — sobre-generalización prematura. Mantenemos `IEtecsaConnector` específico. Cuando llegue el segundo connector (NEXA Downloader), extraemos la abstracción con conocimiento real.

### 11.2 Portal de usuario `nauta.cu:5002`

Documentado en el Doc 1. Fuera de scope Fase 1 (requiere captcha). Cuando se implemente:

- Nueva strategy `UserPortalStrategy` con flujo JWT + captcha.
- Reutiliza `IEtecsaConnector` interfaz existente.
- Nuevo tipo de `SessionData` extendido con `accessToken: string`.

### 11.3 Cambios de ETECSA en runtime

Si ETECSA cambia su HTML y todas las strategies fallan:

1. `ManualFallbackStrategy` retorna error `CONNECTOR_PARSER_FAILED`.
2. Se emite evento al `NotificationEngine`: "Portal ETECSA ha cambiado".
3. Developer Mode muestra los detalles del HTML recibido (sanitizado).
4. El usuario puede exportar logs y enviar al equipo NEXA para agregar una nueva strategy en próximo release.

---

## 12. Pendientes para Fase 2

- Definir el **`SessionData` repository** (capa storage).
- Definir el **`SessionManager`** que orquesta el connector con el `AccountManager`.
- Definir el **event bus** entre SW y UI para reflejar cambios de `ConnectorHealth` en Developer Mode.
- Definir el **`fetch`** polyfill si es necesario en SW (Chrome lo soporta nativamente).
- Definir el **timeout default** (¿15s? ¿20s? — depende de la velocidad típica de red Nauta).

---

**Fin del Documento 2.**
Continúa en `03-implementation-recommendations.md`.
