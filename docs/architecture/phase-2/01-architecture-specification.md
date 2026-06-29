# NEXA NautaX — Architecture Specification

**Fase:** 2
**Documento:** 1 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22
**Vincula:**
- Decision Log Fase 0 (D01-D10) en `/home/z/my-project/worklog.md`
- Decisiones Fase 1 (F1-D1 a F1-D12) en `phase-1/01-etecsa-connector-research-report.md` §9

> Este documento define la arquitectura técnica **definitiva** de NEXA NautaX. Es vinculante para Fases 3-9. No contiene código funcional — solo interfaces, tipos, diagramas y contratos.

---

## 1. Resumen Ejecutivo

NEXA NautaX es una extensión Chromium Manifest V3 premium para administración de cuentas Nauta ETECSA. La arquitectura combina cuatro paradigmas:

1. **Feature-Based Architecture** — organización vertical por feature.
2. **Service Layer** — lógica de aplicación en servicios stateless.
3. **Connector Layer** — aislamiento completo de la integración ETECSA.
4. **State Management Layer** — Zustand como vista, `chrome.storage.local` como fuente de verdad.

### Stack técnico consolidado

| Capa | Tecnología |
|------|-----------|
| Build | Vite + `@crxjs/vite-plugin` (beta) |
| Extension | Manifest V3, Service Worker, SidePanel API |
| UI | React 18 + TypeScript 5.5 strict |
| Estilos | Tailwind CSS 3.4 + shadcn/ui |
| Estado | Zustand 4.5 |
| Validación | Zod 3 |
| Iconos | lucide-react |
| Testing | Vitest + Testing Library |
| Persistencia | `chrome.storage.local` + `chrome.storage.session` |
| Scheduling | `chrome.alarms` |
| Mensajería | `chrome.runtime` + `chrome.storage.onChanged` |

### Principios rectores

1. **Service Worker stateless** — cero estado en memoria. Toda lectura/escritura pasa por storage.
2. **Única fuente de verdad** — `chrome.storage.local` es la verdad; Zustand es caché de UI.
3. **Result<T,E>** — sin throws entre capas. Errores como valores.
4. **Separación estricta** — UI → Services → Connector → HTTP. Nunca saltar capas.
5. **Idempotencia** — toda operación puede repetirse tras un reinicio del SW sin efectos secundarios.
6. **Seguridad por defecto** — credenciales siempre cifradas; logs siempre sanitizados.
7. **Offline-first** — la UI nunca asume conexión con ETECSA.

---

## 2. Decisiones Técnicas Vinculantes (F2-D1 a F2-D18)

Estas decisiones son **no negociables** para las fases siguientes. Cualquier desviación requiere justificación explícita y aprobación del arquitecto.

| # | Decisión | Justificación |
|---|----------|---------------|
| **F2-D1** | SW stateless: cero estado en memoria del Service Worker | MV3 puede terminar el SW en cualquier momento. El estado en memoria se pierde. |
| **F2-D2** | Offscreen Document API para parsing HTML en SW | SW no tiene `DOMParser`. Offscreen doc (Chrome 109+) es la solución oficial. Refina F1-D6. |
| **F2-D3** | Message bus tipado con discriminated union | Type-safety end-to-end entre UI y SW. |
| **F2-D4** | `chrome.storage.onChanged` como único mecanismo de sync SW↔UI | Una sola vía de sincronización evita estados divergentes. |
| **F2-D5** | `chrome.alarms` para todo scheduling (no `setInterval`) | `setInterval` no sobrevive reinicios del SW. Alarms sí. |
| **F2-D6** | Master password + PBKDF2 + `chrome.storage.session` para llave AES | Cumple D04. La llave sobrevive reinicios del SW pero se pierde al cerrar navegador. |
| **F2-D7** | CryptoService aislado como único punto de cifrado/descifrado | Centraliza la seguridad; facilita auditoría. |
| **F2-D8** | Temas via `data-theme` attribute + CSS variables | Sin JS en hot path de renderizado. Cumple D05. |
| **F2-D9** | Feature-based folder structure | Cada feature es vertical slice con components/hooks/store propios. |
| **F2-D10** | `Result<T,E>` propaga hasta UI | Errores como valores; sin throws entre capas. |
| **F2-D11** | NotificationEngine event-driven, no llamado directo por UI | Desacopla productores de eventos de la presentación. |
| **F2-D12** | ConnectionMonitor con múltiples señales | heartbeat + fetch probe + (opcional) `webNavigation` en dev mode. |
| **F2-D13** | Storage versionado con migrations | Cada namespace tiene `schemaVersion`. Migrations automáticas al cargar. |
| **F2-D14** | ESLint + Prettier + TS strict; cero `any`, cero `eslint-disable`, cero `@ts-ignore` | Cumple regla de calidad NEXA. |
| **F2-D15** | Path aliases: `@/*` → `src/*` | Imports limpios, refactor seguro. |
| **F2-D16** | Offscreen document singleton | Una sola instancia de offscreen doc, reutilizada para todo parsing HTML. |
| **F2-D17** | Sin cookies API directa | Usar `fetch` con `credentials: 'include'`. Cookies gestionadas por browser. Reduce permisos. |
| **F2-D18** | Logger sanitizador con regex de patrones sensibles | Cumple D04 + D08. Antes de persistir, sanitiza passwords, tokens, CSRFHW, ATTRIBUTE_UUID, JSESSIONID. |

---

## 3. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR CHROMIUM                                │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │      POPUP       │  │    SIDEPANEL     │  │   OFFSCREEN DOC      │ │
│  │  (Quick Access)  │  │  (Centro op.)    │  │  (DOMParser host)    │ │
│  │  React + Zustand │  │  React + Zustand │  │  Singleton, oculto   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘ │
│           │                      │                       │             │
│           │   chrome.runtime     │                       │  msg bridge │
│           │   sendMessage        │                       │             │
│           ▼                      ▼                       ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  SERVICE WORKER (Core Runtime)                   │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │  │
│  │  │ MessageBus  │  │ EventBus    │  │  ConnectionMonitor      │  │  │
│  │  │ (handlers)  │  │ (pub/sub)   │  │  (heartbeat + probe)    │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │  │
│  │         │                │                      │                │  │
│  │  ┌──────▼──────────────────────────────────────▼─────────────┐ │  │
│  │  │                  APPLICATION SERVICES                     │ │  │
│  │  │                                                              │ │  │
│  │  │  SessionManager    AccountManager     SchedulerEngine      │ │  │
│  │  │  NotificationEngine StorageEngine     DiagnosticEngine     │ │  │
│  │  │  CryptoService      ThemeService      ConnectionMonitor    │ │  │
│  │  └──────┬─────────────────────────────────────────────────┬───┘ │  │
│  │         │                                                 │     │  │
│  │  ┌──────▼─────────────────────────────────────────────┐   │     │  │
│  │  │              CONNECTOR LAYER                       │   │     │  │
│  │  │                                                    │   │     │  │
│  │  │  EtecsaConnector (Facade)                          │   │     │  │
│  │  │    └─ Strategy Chain (5 strategies)                │   │     │  │
│  │  │  HttpClient (fetch wrapper)                        │   │     │  │
│  │  │  HtmlParser (via Offscreen doc)                    │   │     │  │
│  │  │  ErrorMapper (msg español → código)                │   │     │  │
│  │  │  HealthReporter                                    │   │     │  │
│  │  └──────┬─────────────────────────────────────────────┘   │     │  │
│  └─────────┼─────────────────────────────────────────────────┼─────┘  │
│            │                                                 │        │
│            ▼                                                 ▼        │
│  ┌─────────────────────────────────┐  ┌────────────────────────────┐ │
│  │    chrome.storage.local         │  │   chrome.storage.session   │ │
│  │  (Persistente — fuente de verdad)│  │  (Volatile — llave AES)    │ │
│  │                                   │  │                            │ │
│  │  nexa.accounts.*                  │  │  nexa.crypto.aesKey        │ │
│  │  nexa.sessions.*                  │  │  nexa.crypto.derivedAt     │ │
│  │  nexa.history.*                   │  │                            │ │
│  │  nexa.settings.*                  │  └────────────────────────────┘ │
│  │  nexa.scheduler.*                  │                                │
│  │  nexa.logs.*                       │                                │
│  │  nexa.preferences.*                │                                │
│  │  nexa.meta.*                       │                                │
│  └───────────────────────────────────┘                                │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      chrome.alarms                                │ │
│  │  nexa.heartbeat (1 min)   nexa.scheduler.*   nexa.reconnect.*    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │   ETECSA Portal   │
   │ secure.etecsa.net │
   │      :8443        │
   └──────────────────┘
```

---

## 4. Componentes — Responsabilidades Detalladas

### 4.1 Service Worker — Core Runtime

**Archivo:** `src/background/service-worker.ts`

**Responsabilidades:**

- Inicialización de servicios en `chrome.runtime.onInstalled` y `onStartup`.
- Registro de message handlers (`chrome.runtime.onMessage`).
- Registro de alarm handlers (`chrome.alarms.onAlarm`).
- Registro de storage change listeners (para EventBus).
- Coordinación entre servicios.
- Mantener offscreen document vivo cuando se necesita parsing.

**Anti-responsabilidades (lo que NO hace):**

- No contiene lógica de negocio — delega a servicios.
- No mantiene estado en memoria — todo en storage.
- No hace parsing HTML directo — delega a offscreen doc.
- No hace rendering — eso viven en popup/sidepanel.

**Lifecycle:**

```
chrome.runtime.onInstalled
    ├─► migrar storage a versión actual (F2-D13)
    ├─► inicializar default settings
    ├─► registrar alarms permanentes (heartbeat)
    └─► crear offscreen doc si primera instalación

chrome.runtime.onStartup
    ├─► cargar servicios
    ├─► re-registrar alarm handlers (los handlers se pierden tras restart)
    └─► restaurar sesión activa desde storage (si existe)

SW termination (en cualquier momento)
    └─► todo estado en memoria se pierde — aceptable porque es stateless

SW revival (por evento)
    ├─► cargar servicios (lazy)
    └─► continuar operaciones pendientes leyendo storage
```

### 4.2 Popup — Quick Access

**Archivo:** `src/popup/{App.tsx, main.tsx, index.html}`

**Responsabilidades:**

- Login rápido (formulario usuario/contraseña).
- Estado actual de la conexión (cuenta activa, tiempo, saldo).
- Logout rápido.
- Acceso a SidePanel (botón "Abrir Dashboard").
- Cambio rápido de cuenta (si hay múltiples).

**Anti-responsabilidades:**

- No contiene dashboard completo — eso va al SidePanel.
- No contiene CRUD de cuentas — eso va al SidePanel.
- No contiene settings — eso va al SidePanel.
- No contiene Developer Mode — eso va al SidePanel.

**Tamaño objetivo:** 380×520 px (compacto, rápido de abrir).

**Estados UI:**

| Estado | Trigger | UI mostrada |
|--------|---------|-------------|
| `LOCKED` | Extensión cerrada y master password no ingresada | Pantalla unlock |
| `ONBOARDING` | Primera vez, sin master password creada | Crear master password |
| `LOGGED_OUT` | Sin sesión ETECSA activa | Form login |
| `CONNECTING` | Login en progreso | Spinner + mensaje |
| `CONNECTED` | Sesión activa | Resumen + acciones |
| `OFFLINE` | Sin conexión ETECSA | Aviso + CRUD local |
| `ERROR` | Fallo de operación | Error + acción recomendada |

### 4.3 SidePanel — Centro Operativo

**Archivo:** `src/sidepanel/{App.tsx, main.tsx, index.html}`

**Responsabilidades:**

- Dashboard (cards de estado, gráficos de consumo).
- Accounts (CRUD completo de cuentas).
- Scheduler (programar desconexiones).
- Settings (temas, notificaciones, seguridad, export/import).
- Developer Mode (logs, network debug, tools).

**Anti-responsabilidades:**

- No replica el popup — el SidePanel es más profundo.
- No hace llamadas directas a ETECSA — pasa por SessionManager.

**Navegación:**

```
SidePanel
├── Dashboard       (default)
├── Accounts
├── Scheduler
├── Settings
│   ├── Appearance
│   ├── Behavior
│   ├── Notifications
│   ├── Security
│   └── Backup
└── Developer Mode
    ├── Logs
    ├── Session Inspector
    ├── Connector Inspector
    ├── Network Debug
    ├── Storage Viewer
    └── Tools
```

**Routing:** Estado interno Zustand (no React Router) — más simple y suficiente para navegación entre 5 secciones.

### 4.4 Offscreen Document — DOM Parsing Host

**Archivos:**
- `src/offscreen/offscreen.html`
- `src/offscreen/offscreen.ts`

**Justificación (F2-D2):**

El Service Worker en MV3 **no tiene acceso a DOM APIs** — no existe `DOMParser`, no existe `document`. Pero el ETECSA Connector necesita parsear HTML para extraer `CSRFHW`, `ATTRIBUTE_UUID`, mensajes de error en `<script>alert("...")`, y bloque `#sessioninfo`.

Google provee la **Offscreen Document API** (Chrome 109+) como solución oficial: un documento oculto que tiene acceso completo al DOM y se comunica con el SW via `chrome.runtime.sendMessage`.

**Responsabilidades:**

- Recibir HTML string desde SW via mensaje.
- Parsear con `DOMParser`.
- Extraer campos solicitados (login form, attribute uuid, alert message, session info).
- Devolver resultado tipado al SW.

**Lifecycle:**

- Singleton — solo una instancia existe en cualquier momento (F2-D16).
- Creado bajo demanda cuando el Connector necesita parsing.
- Cerrado cuando no se ha usado por 30s (para no consumir memoria).
- Re-creado si se cierra y se vuelve a necesitar.

**API expuesta al SW:**

```typescript
// Mensajes del SW al Offscreen doc
type OffscreenRequest =
  | { type: 'PARSE_LOGIN_FORM'; html: string }
  | { type: 'EXTRACT_ATTRIBUTE_UUID'; html: string }
  | { type: 'EXTRACT_ALERT_MESSAGE'; html: string }
  | { type: 'EXTRACT_SESSION_INFO'; html: string };

type OffscreenResponse =
  | { ok: true; data: ParsedData }
  | { ok: false; error: 'PARSE_FAILED'; reason: string };
```

---

## 5. Application Services Layer

### 5.1 Visión general

Los servicios son **stateless** y **singleton lógicos** (no literales — cada invocación lee/escribe storage). Residen en el SW. La UI nunca los llama directamente; los invoca via message bus.

```
┌─────────────────────────────────────────────────────────┐
│                  Application Services                    │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ SessionManager │◄─┤ AccountManager  │                 │
│  └───────┬────────┘  └────────┬───────┘                 │
│          │                    │                          │
│          │  ┌─────────────────▼──────────────┐          │
│          │  │ SchedulerEngine                 │          │
│          │  └─────────────────┬──────────────┘          │
│          │                    │                          │
│          ▼                    ▼                          │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ StorageEngine  │  │NotificationEng.│                 │
│  └───────┬────────┘  └────────┬───────┘                 │
│          │                    │                          │
│          │  ┌─────────────────▼──────────────┐          │
│          │  │ DiagnosticEngine                │          │
│          │  └─────────────────┬──────────────┘          │
│          │                    │                          │
│          ▼                    ▼                          │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │ CryptoService  │  │ ThemeService   │                 │
│  └────────────────┘  └────────────────┘                 │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │      ConnectionMonitor                  │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Resumen de servicios

| Servicio | Responsabilidad principal | Documento |
|----------|---------------------------|-----------|
| `SessionManager` | Fuente única de verdad del estado de sesión ETECSA | Doc 3 §2 |
| `AccountManager` | CRUD de cuentas, selección, validación | Doc 3 §3 |
| `SchedulerEngine` | Programación de logout, temporizadores | Doc 3 §4 |
| `NotificationEngine` | Toasts NEXA custom, badges, icon states | Doc 3 §5 |
| `StorageEngine` | Abstracción sobre `chrome.storage.local` | Doc 3 §6 |
| `DiagnosticEngine` | Logs, métricas, health reports | Doc 3 §7 |
| `CryptoService` | PBKDF2, AES-GCM, sanitización | Doc 3 §8 |
| `ThemeService` | Aplicar tema, persistir preferencia | Doc 3 §9 |
| `ConnectionMonitor` | Detectar online/offline/captive portal | Doc 3 §10 |

> El detalle completo (interfaces, métodos, eventos, dependencias) está en el Documento 3 de esta Fase.

---

## 6. Connector Layer

### 6.1 Resumen (definido en Fase 1)

Ver `phase-1/02-nexa-connector-architecture-proposal.md` para el detalle completo. Resumen aquí para coherencia:

```
┌─────────────────────────────────────────┐
│         IEtecsaConnector (interface)     │
└──────────────────┬──────────────────────┘
                   │ implements
       ┌───────────┴────────────┐
       │                        │
┌──────▼──────┐         ┌───────▼────────────┐
│EtecsaConn.  │         │MockEtecsaConnector │
│  (Facade)   │         │  (tests/dev)       │
└──────┬──────┘         └────────────────────┘
       │
       ├─► Strategy Chain (5 strategies)
       │     ├─ KnownEndpointStrategy
       │     ├─ DiscoveredEndpointStrategy
       │     ├─ ScrapingDomStrategy (via Offscreen doc)
       │     ├─ ScrapingRegexStrategy
       │     └─ ManualFallbackStrategy
       │
       ├─► HttpClient (fetch wrapper)
       ├─► HtmlParser (via Offscreen doc)
       ├─► ErrorMapper (msg español → código)
       └─► HealthReporter (events → DiagnosticEngine)
```

### 6.2 Refinamientos Fase 2

- **F2-D2**: `HtmlParser` delega a offscreen document. El SW no parsea HTML directamente.
- **F2-D17**: HttpClient usa `fetch` con `credentials: 'include'`. No usa `chrome.cookies` API. Reduce permisos y simplifica.
- **F2-D18**: Antes de loggear cualquier request/response, el `HealthReporter` sanitiza tokens con regex.

---

## 7. State Management Layer

### 7.1 Filosofía

**`chrome.storage.local` es la única fuente de verdad. Zustand es caché de UI.**

```
┌─────────────────────┐         ┌─────────────────────┐
│ chrome.storage.local│         │    Zustand stores    │
│  (FUENTE DE VERDAD) │ ──────► │   (CACHÉ DE UI)     │
│                     │ ◄────── │                     │
│  - escrita por SW   │  write  │  - leída por UI     │
│  - leída por SW     │         │  - actualizada vía   │
│                     │ onChanged│    storage events   │
└─────────────────────┘ event   └─────────────────────┘
                                       ▲
                                       │
                              ┌────────┴────────┐
                              │  React components │
                              │  (suscriben a    │
                              │   selectors)     │
                              └──────────────────┘
```

### 7.2 Stores

Cada store es un slice vertical. Todos siguen el mismo patrón:

```typescript
// Patrón conceptual (no implementación)
interface StoreSlice<TState, TActions> {
  state: TState;
  actions: TActions;
  hydrate: () => Promise<void>;          // lee de storage al montar
  subscribeToStorage: () => () => void;  // escucha cambios
}
```

#### Stores definidos

| Store | Estado principal | Acciones | Persistencia |
|-------|------------------|----------|--------------|
| `sessionStore` | status, activeSession, timeRemaining | login, logout, refresh, reconnect | storage.local `nexa.sessions.*` |
| `accountStore` | accounts[], selectedAccountId | create, update, delete, select | storage.local `nexa.accounts.*` |
| `settingsStore` | theme, notifications, behavior | updateTheme, updateNotifications, ... | storage.local `nexa.settings.*` |
| `schedulerStore` | tasks[], nextRun | createTask, cancelTask | storage.local `nexa.scheduler.*` |
| `diagnosticStore` | logs[], connectorHealth, networkHistory | log, clear, export | storage.local `nexa.logs.*` |
| `uiStore` | activeView, toasts[], loading flags | setView, pushToast, dismissToast | NO persistido (efímero) |
| `cryptoStore` | locked, derivedAt, hasMasterPassword | unlock, lock, changeMasterPassword | storage.session `nexa.crypto.*` |

### 7.3 Sincronización SW ↔ UI

**Una sola vía: `chrome.storage.onChanged`.**

```
SW escribe en storage.local
        │
        ▼
chrome.storage.onChanged event se dispara
        │
        ▼
Cada store de UI tiene un listener
        │
        ▼
Listener actualiza estado Zustand
        │
        ▼
React re-renderiza automáticamente
```

**Anti-patrón prohibido:** enviar mensaje del SW a la UI via `chrome.runtime.sendMessage` para notificar cambios de estado. Eso crea dos vías de sincronización y rompe la unicidad.

**Excepción:** `chrome.runtime.sendMessage` se usa SOLO para:
- Solicitudes de UI al SW (ej: "ejecuta login").
- Eventos efímeros no persistidos (ej: "abrir sidepanel").

### 7.4 Hidratación inicial

Cuando el popup o sidepanel se monta:

1. Store llama a `hydrate()` que lee de `chrome.storage.local`.
2. Store subscribe a `chrome.storage.onChanged` para updates.
3. Store queda sincronizado.

Si el SW escribe mientras la UI está cerrada, no hay problema — la próxima vez que la UI se abra, `hydrate()` leerá el estado actual.

---

## 8. Message Bus

### 8.1 Tipos de mensaje

```typescript
// src/types/messages.ts

type ExtensionMessage =
  // —— Sesión ——
  | { type: 'SESSION_LOGIN'; accountId: AccountId }
  | { type: 'SESSION_LOGOUT' }
  | { type: 'SESSION_RECONNECT' }
  | { type: 'SESSION_REFRESH' }
  | { type: 'SESSION_GET_STATE' }
  // —— Cuentas ——
  | { type: 'ACCOUNT_CREATE'; payload: NewAccountInput }
  | { type: 'ACCOUNT_UPDATE'; accountId: AccountId; payload: AccountUpdateInput }
  | { type: 'ACCOUNT_DELETE'; accountId: AccountId }
  | { type: 'ACCOUNT_SELECT'; accountId: AccountId }
  | { type: 'ACCOUNT_VERIFY_CREDENTIALS'; accountId: AccountId }
  // —— Scheduler ——
  | { type: 'SCHEDULER_CREATE_TASK'; payload: NewSchedulerTaskInput }
  | { type: 'SCHEDULER_CANCEL_TASK'; taskId: SchedulerTaskId }
  | { type: 'SCHEDULER_LIST_TASKS' }
  // —— Settings ——
  | { type: 'SETTINGS_UPDATE'; payload: Partial<Settings> }
  | { type: 'SETTINGS_GET' }
  // —— Diagnóstico ——
  | { type: 'DIAGNOSTIC_GET_LOGS'; filter?: LogFilter }
  | { type: 'DIAGNOSTIC_CLEAR_LOGS' }
  | { type: 'DIAGNOSTIC_EXPORT' }
  | { type: 'DIAGNOSTIC_RUN_TOOL'; tool: DiagnosticTool }
  // —— Crypto ——
  | { type: 'CRYPTO_UNLOCK'; masterPassword: string }
  | { type: 'CRYPTO_LOCK' }
  | { type: 'CRYPTO_CREATE_MASTER'; masterPassword: string }
  | { type: 'CRYPTO_CHANGE_MASTER'; old: string; new: string }
  | { type: 'CRYPTO_GET_STATE' }
  // —— Backup ——
  | { type: 'BACKUP_EXPORT' }
  | { type: 'BACKUP_IMPORT'; payload: BackupPackage }
  // —— Connection ——
  | { type: 'CONNECTION_PROBE' }
  | { type: 'CONNECTION_GET_STATUS' }
  // —— Offscreen ——
  | { type: 'OFFSCREEN_PARSE'; payload: OffscreenRequest };

type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: NexaError };
```

### 8.2 Handler pattern

```typescript
// Patrón conceptual (no implementación)
type MessageHandler<M extends ExtensionMessage> = (
  message: M
) => Promise<ExtensionResponse>;

// Registro en SW
messageBus.register('SESSION_LOGIN', sessionManager.handleLogin);
messageBus.register('ACCOUNT_CREATE', accountManager.handleCreate);
// ...
```

### 8.3 Flujo tipado UI → SW

```typescript
// En UI
const result = await sendMessage({
  type: 'SESSION_LOGIN',
  accountId: 'acc_123' as AccountId,
});

if (result.ok) {
  // actualizar UI
} else {
  // mostrar error tipado
}
```

TypeScript garantiza que el caller pasa el payload correcto para cada `type`.

---

## 9. Event Bus Interno

### 9.1 Justificación

El message bus (`chrome.runtime`) comunica UI ↔ SW. Pero los servicios dentro del SW también necesitan comunicarse entre sí sin acoplamiento directo. El EventBus resuelve esto.

### 9.2 Eventos tipados

```typescript
// src/types/events.ts

type ExtensionEvent =
  // —— Sesión ——
  | { type: 'SESSION_STARTED'; session: SessionData; at: number }
  | { type: 'SESSION_LOST'; reason: DisconnectReason; at: number }
  | { type: 'SESSION_EXPIRED'; at: number }
  | { type: 'SESSION_REFRESHED'; session: SessionData; at: number }
  // —— Conexión ——
  | { type: 'CONNECTION_ONLINE'; at: number }
  | { type: 'CONNECTION_OFFLINE'; reason: string; at: number }
  | { type: 'CONNECTION_CAPTIVE_PORTAL'; at: number }
  // —— Cuenta ——
  | { type: 'ACCOUNT_CREATED'; account: Account; at: number }
  | { type: 'ACCOUNT_DELETED'; accountId: AccountId; at: number }
  | { type: 'ACCOUNT_SELECTED'; accountId: AccountId; at: number }
  // —— Connector ——
  | { type: 'CONNECTOR_OPERATION_SUCCESS'; operation: string; strategy: StrategyName; timing: HttpTiming; at: number }
  | { type: 'CONNECTOR_OPERATION_FAILURE'; operation: string; strategy: StrategyName; error: EtecsaError; at: number }
  | { type: 'CONNECTOR_FALLBACK'; operation: string; from: StrategyName; to: StrategyName; at: number }
  | { type: 'CONNECTOR_DEGRADED'; reason: string; at: number }
  // —— Crypto ——
  | { type: 'CRYPTO_LOCKED'; at: number }
  | { type: 'CRYPTO_UNLOCKED'; at: number }
  // —— Scheduler ——
  | { type: 'SCHEDULER_TASK_FIRED'; taskId: SchedulerTaskId; at: number }
  | { type: 'SCHEDULER_TASK_COMPLETED'; taskId: SchedulerTaskId; success: boolean; at: number }
  // —— Balance ——
  | { type: 'BALANCE_UPDATED'; balance: Balance; at: number }
  | { type: 'BALANCE_LOW'; amount: number; threshold: number; at: number };
```

### 9.3 Suscriptores

| Servicio | Eventos que escucha |
|----------|---------------------|
| `NotificationEngine` | `SESSION_LOST`, `BALANCE_LOW`, `CONNECTOR_DEGRADED`, `SCHEDULER_TASK_COMPLETED` |
| `DiagnosticEngine` | Todos — es el logger central |
| `SchedulerEngine` | `SESSION_STARTED`, `SESSION_LOST` (para cancelar timers huérfanos) |
| `SessionManager` | `CONNECTION_OFFLINE`, `CONNECTION_CAPTIVE_PORTAL` |
| `ConnectionMonitor` | `SESSION_LOST` (para forzar probe inmediato) |
| `StorageEngine` | Ninguno — solo escribe lo que le piden |

### 9.4 Implementación conceptual

```typescript
interface EventBus {
  publish<E extends ExtensionEvent>(event: E): void;
  subscribe<E extends ExtensionEvent['type']>(
    type: E,
    handler: (event: Extract<ExtensionEvent, { type: E }>) => void
  ): () => void;  // unsubscribe
}
```

Los eventos NO se persisten — son efímeros. Si el SW muere entre publish y subscribe, el evento se pierde. Para estado durable, usar storage.

---

## 10. Security Architecture

### 10.1 Modelo de credenciales

**Flujo:**

```
1. Onboarding (primera vez)
   └─► Usuario crea master password
       └─► CryptoService.deriveKey(masterPassword, salt=per-installation)
           └─► AES key (256 bits) guardada en chrome.storage.session
       └─► Verifier (hash de un string conocido cifrado) guardado en storage.local
       └─► Salt guardado en storage.local

2. Unlock (sesiones siguientes)
   └─► Usuario ingresa master password
       └─► CryptoService.deriveKey(masterPassword, salt=stored)
           └─► AES key en chrome.storage.session
       └─► Verifier check → si coincide, unlock OK

3. Operaciones
   └─► Al guardar cuenta:
       └─► CryptoService.encrypt(plaintextPassword, aesKey)
           └─► encryptedPassword guardado en storage.local
   └─► Al usar cuenta para login:
       └─► CryptoService.decrypt(encryptedPassword, aesKey)
           └─► plaintextPassword en memoria solo durante login
           └─► NUNCA se persiste plaintext

4. Lock (cierre de navegador o acción manual)
   └─► chrome.storage.session se limpia
       └─► AES key se pierde
       └─► Requieres unlock para operar de nuevo
```

### 10.2 Parámetros criptográficos

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| Algoritmo simétrico | AES-GCM 256 bits | Estándar Web Crypto API; authenticated encryption. |
| KDF | PBKDF2 | Disponible en Web Crypto API. |
| Iteraciones PBKDF2 | 250,000 | Equilibrio seguridad/performance; recomendación OWASP 2023. |
| Hash KDF | SHA-256 | Disponible en Web Crypto API. |
| Salt | 16 bytes aleatorios por instalación | Generado en onboarding; nunca cambia. |
| IV | 12 bytes aleatorios por cifrado | Generado en cada `encrypt()`, prependido al ciphertext. |
| Master password mínima | 8 caracteres | Recomendado pero advertimos al usuario si es débil. |

### 10.3 Sanitización de logs (F2-D18)

```typescript
// Patrones regex a sanitizar antes de loggear
const SANITIZE_PATTERNS = [
  { pattern: /password=[^&\s]+/gi, replacement: 'password=***' },
  { pattern: /ATTRIBUTE_UUID=\w+/g, replacement: 'ATTRIBUTE_UUID=***' },
  { pattern: /CSRFHW=\w+/g, replacement: 'CSRFHW=***' },
  { pattern: /JSESSIONID=\w+/gi, replacement: 'JSESSIONID=***' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***' },  // emails
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '***.***.***.***' },  // IPs
];

function sanitize(input: string): string {
  return SANITIZE_PATTERNS.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    input
  );
}
```

Toda string que entre al `DiagnosticEngine.log()` pasa por `sanitize()` primero.

### 10.4 Permisos del manifest

Mínimos justificables para Web Store (D06):

```json
{
  "permissions": [
    "storage",        // StorageEngine
    "alarms",         // SchedulerEngine, ConnectionMonitor
    "sidePanel",      // SidePanel API
    "offscreen"       // Offscreen doc para HTML parsing
  ],
  "host_permissions": [
    "https://secure.etecsa.net:8443/*"  // ETECSA captive portal
  ]
}
```

**No solicitamos:**
- `cookies` — usamos `fetch` con `credentials: 'include'` (F2-D17).
- `webNavigation` — solo activado en Developer Mode opcional.
- `tabs` — innecesario.
- `<all_urls>` — prohibido por Web Store policy.

### 10.5 Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'"
  }
}
```

Prohíbe:
- Scripts inline.
- `eval`.
- Carga de scripts remotos.
- WebAssembly modules desde URLs externas (solo `self`).

---

## 11. Offline Architecture

### 11.1 Estados de conexión (D07)

```typescript
type ConnectionState =
  | 'ONLINE'              // hay internet, no en portal cautivo
  | 'CAPTIVE_PORTAL'      // ETECSA espera login
  | 'CONNECTING'          // login en progreso
  | 'AUTHENTICATED'       // sesión ETECSA activa
  | 'SESSION_EXPIRED'     // sesión perdida, portal sigue accesible
  | 'OFFLINE'             // sin red
  | 'ERROR';              // error indeterminado
```

### 11.2 Matriz de capacidades por estado

| Operación | ONLINE | CAPTIVE_PORTAL | CONNECTING | AUTHENTICATED | SESSION_EXPIRED | OFFLINE |
|-----------|--------|----------------|------------|---------------|-----------------|---------|
| Login | — | ✓ | ✗ | ✗ | ✓ | ✗ |
| Logout | — | — | — | ✓ | — | ✗ |
| getBalance | — | — | — | ✓ | — | ✗ |
| getTimeRemaining | — | — | — | ✓ | — | ✗ |
| CRUD cuentas | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver historial | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cambiar settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Developer Mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backup export | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backup import | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto-reconnect | — | ✓ | ✗ | — | ✓ | ✗ |

> El símbolo "—" significa "no aplica" (ej: logout cuando no hay sesión).

### 11.3 Detección de estado

`ConnectionMonitor` (Doc 3 §10) ejecuta probes periódicos:

1. **Heartbeat alarm** cada 60s (F2-D5).
2. **Probe a `connectivitycheck.gstatic.com/generate_204`** — si 204, `ONLINE`.
3. **Si no 204, probe a `https://secure.etecsa.net:8443/`** — si 200 con form de login, `CAPTIVE_PORTAL`.
4. **Si ambos fallan**, `OFFLINE`.

### 11.4 Comportamiento UI en OFFLINE

- Banners visibles: "Sin conexión con ETECSA".
- Botones de login/logout deshabilitados con tooltip explicativo.
- Botones de CRUD cuentas, settings, historial, developer mode, backup — habilitados.
- Auto-reconnect pausado — no reintenta cuando `OFFLINE`, solo cuando `CAPTIVE_PORTAL` o `SESSION_EXPIRED`.

---

## 12. Theme Architecture

### 12.1 Tokens (definidos en Fase 3)

Cada tema define un set de CSS variables:

```css
:root[data-theme="dark"] {
  --background: #0a0a0b;
  --foreground: #fafafa;
  --primary: #6366f1;
  --secondary: #1e1e22;
  --accent: #a78bfa;
  --border: #27272a;
  --card: #18181b;
  --muted: #71717a;
}

:root[data-theme="light"] { /* ... */ }
:root[data-theme="nebula"] { /* ... */ }
:root[data-theme="aurora"] { /* ... */ }
```

### 12.2 Application

```typescript
// ThemeService aplica tema así:
document.documentElement.setAttribute('data-theme', theme);
```

No hay JS en el hot path de renderizado — solo CSS variables.

### 12.3 Selección de tema

| Modo | Comportamiento |
|------|---------------|
| Manual | Usuario elige Dark/Light/Nebula/Aurora. Persiste en `nexa.settings.theme`. |
| Sistema | Sigue `prefers-color-scheme`. Solo aplica a Dark/Light; si sistema es light, usa Light; si dark, usa Dark. Nebula y Aurora son manuales. |

### 12.4 Default

**Dark** (D05). Si usuario no ha elegido, default a Dark.

---

## 13. Future-Ready Architecture

### 13.1 Estructura preparada para evolución

```
src/
├── connectors/
│   └── etecsa/        # Implementado en Fase 6
│   ├── _template/     # Template para nuevos connectors (no compilado)
│   ├── (future) downloader/
│   ├── (future) browser/
│   ├── (future) proxy/
│   └── (future) iptv/
├── providers/         # Para abstracciones comunes (auth, http, etc.)
├── modules/           # Para módulos transversales (crypto, logging, events)
└── plugins/           # Para extensiones opcionales futuras
```

### 13.2 Multi-producto NEXA

Cuando se agregue **NEXA Downloader** u otro producto:

- Cada producto tiene su propia extensión Chrome (no compartimos manifest).
- Compartimos **patrones arquitectónicos** (este documento).
- Compartimos **módulos** (`modules/crypto`, `modules/logging`, `modules/events`) via workspace interno.
- Los connectors son independientes por producto.

### 13.3 Plugin architecture (futuro v2.0)

Reservado `src/plugins/` para:
- Hooks de extensibilidad (pre-login, post-logout, etc.).
- Módulos opcionales (ej: "sincronización NEXA Cloud").
- Feature flags activables.

**No implementado en Fase 1-9.** Solo reservado el namespace.

---

## 14. Manejo de Errores

### 14.1 NexaError jerarquía

```typescript
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

interface NexaError {
  readonly code: string;            // ej: 'AUTH_INVALID_CREDENTIALS'
  readonly category: NexaErrorCategory;
  readonly technicalMessage: string; // para Developer Mode (inglés técnico)
  readonly userMessage: string;     // español (D10)
  readonly recommendedAction: string;  // español
  readonly retryable: boolean;
  readonly cause?: NexaError | unknown;
  readonly timestamp: number;
}
```

### 14.2 Propagación

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

### 14.3 Errores fatales

Errores que rompen invariantes de sistema (ej: storage corrupto, llave AES perdida):

- Loguear a `DiagnosticEngine` con nivel `FATAL`.
- Mostrar pantalla de error con "Reiniciar extensión" como única opción.
- No intentar recuperación automática.

---

## 15. Performance Considerations

### 15.1 Budget de tamaño

| Asset | Budget | Justificación |
|-------|--------|---------------|
| Popup HTML+JS+CSS gzipped | < 80 KB | Tiempo de apertura rápido. |
| SidePanel HTML+JS+CSS gzipped | < 200 KB | Carga una sola vez. |
| Service Worker | < 100 KB | Arranque rápido del SW. |
| Offscreen doc | < 30 KB | Mínimo HTML + parser. |
| Fuentes autohospedadas (3 familias) | < 200 KB total | Subset solo con caracteres necesarios. |

### 15.2 Optimizaciones

- **Code splitting** por entry point (popup, sidepanel, sw, offscreen) — `@crxjs` lo maneja.
- **Lazy load** de módulos pesados del SidePanel (Developer Mode, gráficos).
- **Memoización** en React con `React.memo` + `useMemo` para componentes costosos.
- **Selectors Zustand** atomizados — evitar re-renders innecesarios.
- **Debounce** en inputs de formulario (300ms).
- **Virtualización** de listas largas (logs en Developer Mode) con `react-virtual` o similar.

### 15.3 Anti-patrones de performance

- No cargar todas las fuentes en el popup — solo las necesarias para esa vista.
- No incluir librerías de gráficos pesadas — usar SVG custom o `recharts` si estrictamente necesario.
- No hacer polling en UI — suscribirse a storage events.
- No hacer fetch desde UI — siempre via SW.

---

## 16. Logging y Diagnóstico

### 16.1 Niveles

| Nivel | Cuándo | Dónde se muestra |
|-------|--------|------------------|
| `DEBUG` | Detalle fino, valores intermedios | Developer Mode (con filter) |
| `INFO` | Eventos normales (login OK, logout OK) | Developer Mode |
| `WARN` | Algo inesperado pero recuperable (strategy fallback) | Developer Mode + Toast opcional |
| `ERROR` | Fallo de operación | Developer Mode + Toast |
| `FATAL` | Invariante rota | Pantalla de error |

### 16.2 Retención

- Máximo **5,000 logs** en `chrome.storage.local`.
- Política FIFO — los más antiguos se eliminan.
- Exportación manual desde Developer Mode (Fase 7).
- Limpieza automática opcional configurable en Settings.

### 16.3 Estructura de log

```typescript
interface LogEntry {
  readonly id: string;          // uuid
  readonly timestamp: number;
  readonly level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  readonly category: string;    // 'session', 'connector', 'crypto', ...
  readonly message: string;     // sanitizado
  readonly details?: unknown;   // sanitizado, opcional
  readonly traceId?: string;    // correlaciona operaciones multi-step
}
```

---

## 17. Testing Strategy (overview — detalle en Fase 8)

| Tipo | Cobertura | Herramienta |
|------|-----------|-------------|
| Unit | Servicios, parsers, utils | Vitest |
| Integration | Message bus, storage, alarms | Vitest + fake chrome APIs |
| E2E | Flujos completos con MockEtecsaConnector | Vitest + Playwright (opcional) |
| Fixture-based | HTML parsing con corpus real | Vitest + `tests/fixtures/etecsa-html/` |
| Manual | Smoke test en Chrome dev mode | Checklist humano |

---

## 18. Pendientes para Fases siguientes

### Fase 3 (UX/UI)
- Definir design tokens exactos (colores, tipografía, espaciados).
- Diseñar component library (shadcn/ui base + custom NEXA).
- Definir layouts de popup y sidepanel.
- Diseñar estados visuales de cada componente.

### Fase 4 (Data Model)
- Schema exacto de cada entidad (Account, Session, Balance, etc.).
- Namespaces de storage con `schemaVersion` (F2-D13).
- Migrations iniciales.
- Contratos de Export/Import.

### Fase 5 (Núcleo)
- Setup del proyecto (Vite + @crxjs + React + TS + Tailwind).
- Manifest V3 base.
- Service Worker skeleton.
- Storage engine + repositories.
- Zustand stores skeleton.
- ThemeProvider + 4 temas.
- Popup + SidePanel skeletons.
- Developer Mode skeleton.

### Fase 6 (Connector)
- Implementar strategies (5).
- HttpClient.
- HtmlParser via offscreen doc.
- ErrorMapper.
- MockEtecsaConnector.
- Fixture corpus.
- Tests.

---

**Fin del Documento 1.**
Continúa en `02-project-folder-structure.md`.
