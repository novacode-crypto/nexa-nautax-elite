# NEXA NautaX — Project Folder Structure

**Fase:** 2
**Documento:** 2 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Estructura definitiva del proyecto. Vinculante para Fases 5-9. Cada carpeta tiene un propósito único — ningún archivo debe poder vivir en dos carpetas distintas.

---

## 1. Árbol completo

```
nexa-nautax/
│
├── public/
│   ├── icons/                          # Iconos de la extensión (PNG/SVG)
│   │   ├── icon-16.png
│   │   ├── icon-32.png
│   │   ├── icon-48.png
│   │   ├── icon-128.png
│   │   ├── icon-states/                # Variantes por estado de sesión
│   │   │   ├── connected.png
│   │   │   ├── reconnecting.png
│   │   │   ├── disconnected.png
│   │   │   └── no-account.png
│   │   └── icon-source.svg             # Fuente editable
│   └── fonts/                          # Fuentes autohospedadas
│       ├── syne/
│       │   ├── Syne-Regular.woff2
│       │   ├── Syne-Medium.woff2
│       │   ├── Syne-SemiBold.woff2
│       │   └── Syne-Bold.woff2
│       ├── dnsans/
│       │   ├── DNSans-Regular.woff2
│       │   ├── DNSans-Medium.woff2
│       │   └── DNSans-Bold.woff2
│       └── jetbrainsmono/
│           ├── JetBrainsMono-Regular.woff2
│           └── JetBrainsMono-Bold.woff2
│
├── src/
│   │
│   ├── app/                            # Entry points (uno por surface)
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── main.tsx                # Bootstrap React
│   │   │   └── App.tsx                 # Root component
│   │   ├── sidepanel/
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── App.tsx
│   │   ├── background/
│   │   │   └── service-worker.ts       # SW bootstrap
│   │   └── offscreen/
│   │       ├── index.html
│   │       └── offscreen.ts            # DOM parsing host
│   │
│   ├── components/                     # Componentes UI primitivos (shadcn/ui + custom NEXA)
│   │   ├── ui/                         # shadcn/ui base (button, card, dialog, etc.)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   ├── nexa/                       # Componentes NEXA custom
│   │   │   ├── NexaLogo.tsx
│   │   │   ├── NexaButton.tsx
│   │   │   ├── NexaCard.tsx
│   │   │   ├── NexaStatusIndicator.tsx
│   │   │   ├── NexaToast.tsx
│   │   │   ├── NexaToastContainer.tsx
│   │   │   ├── NexaIcon.tsx
│   │   │   ├── NexaSpinner.tsx
│   │   │   ├── NexaBanner.tsx
│   │   │   ├── NexaEmptyState.tsx
│   │   │   └── NexaConfirmDialog.tsx
│   │   └── layout/                     # Layouts reutilizables
│   │       ├── SidePanelLayout.tsx
│   │       ├── SidePanelHeader.tsx
│   │       ├── SidePanelNav.tsx
│   │       ├── SidePanelFooter.tsx
│   │       └── PopupLayout.tsx
│   │
│   ├── features/                       # Slices verticales por feature
│   │   ├── auth/                       # Login/logout flows
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── LogoutButton.tsx
│   │   │   │   ├── ConnectionStatusCard.tsx
│   │   │   │   └── ReconnectButton.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useLogin.ts
│   │   │   │   ├── useLogout.ts
│   │   │   │   └── useReconnect.ts
│   │   │   └── schema.ts              # Zod schemas de inputs
│   │   │
│   │   ├── accounts/                   # CRUD de cuentas
│   │   │   ├── components/
│   │   │   │   ├── AccountList.tsx
│   │   │   │   ├── AccountCard.tsx
│   │   │   │   ├── AccountFormDialog.tsx
│   │   │   │   ├── AccountDeleteDialog.tsx
│   │   │   │   └── AccountTypeBadge.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAccounts.ts
│   │   │   │   └── useAccountActions.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── dashboard/                  # Dashboard del SidePanel
│   │   │   ├── components/
│   │   │   │   ├── DashboardOverview.tsx
│   │   │   │   ├── ActiveSessionCard.tsx
│   │   │   │   ├── BalanceCard.tsx
│   │   │   │   ├── TimeRemainingCard.tsx
│   │   │   │   ├── UsageChart.tsx
│   │   │   │   └── LastSessionsList.tsx
│   │   │   └── hooks/
│   │   │       └── useDashboardData.ts
│   │   │
│   │   ├── scheduler/                  # Programación de desconexiones
│   │   │   ├── components/
│   │   │   │   ├── SchedulerPanel.tsx
│   │   │   │   ├── TimerBasedScheduler.tsx
│   │   │   │   ├── TimeBasedScheduler.tsx
│   │   │   │   └── ActiveTasksList.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useScheduler.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── settings/                   # Configuración general
│   │   │   ├── components/
│   │   │   │   ├── SettingsPanel.tsx
│   │   │   │   ├── AppearanceSettings.tsx
│   │   │   │   ├── BehaviorSettings.tsx
│   │   │   │   ├── NotificationSettings.tsx
│   │   │   │   ├── SecuritySettings.tsx
│   │   │   │   └── BackupSettings.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useSettings.ts
│   │   │   └── schema.ts
│   │   │
│   │   ├── developer/                  # Developer Mode
│   │   │   ├── components/
│   │   │   │   ├── DeveloperPanel.tsx
│   │   │   │   ├── LogsViewer.tsx
│   │   │   │   ├── SessionInspector.tsx
│   │   │   │   ├── ConnectorInspector.tsx
│   │   │   │   ├── NetworkDebugPanel.tsx
│   │   │   │   ├── StorageViewer.tsx
│   │   │   │   └── DevTools.tsx
│   │   │   └── hooks/
│   │   │       ├── useLogs.ts
│   │   │       └── useConnectorHealth.ts
│   │   │
│   │   ├── onboarding/                 # Setup inicial (master password)
│   │   │   └── components/
│   │   │       ├── OnboardingFlow.tsx
│   │   │       ├── CreateMasterPassword.tsx
│   │   │       └── ConfirmMasterPassword.tsx
│   │   │
│   │   └── unlock/                     # Pantalla de unlock
│   │       └── components/
│   │           └── UnlockScreen.tsx
│   │
│   ├── services/                       # Lógica de aplicación (stateless)
│   │   ├── session/
│   │   │   ├── SessionManager.ts
│   │   │   ├── sessionManager.types.ts
│   │   │   └── index.ts
│   │   ├── accounts/
│   │   │   ├── AccountManager.ts
│   │   │   ├── accountManager.types.ts
│   │   │   └── index.ts
│   │   ├── scheduler/
│   │   │   ├── SchedulerEngine.ts
│   │   │   ├── schedulerEngine.types.ts
│   │   │   └── index.ts
│   │   ├── notification/
│   │   │   ├── NotificationEngine.ts
│   │   │   ├── notificationEngine.types.ts
│   │   │   └── index.ts
│   │   ├── storage/
│   │   │   ├── StorageEngine.ts
│   │   │   ├── storageEngine.types.ts
│   │   │   └── index.ts
│   │   ├── diagnostics/
│   │   │   ├── DiagnosticEngine.ts
│   │   │   ├── diagnosticEngine.types.ts
│   │   │   └── index.ts
│   │   ├── crypto/
│   │   │   ├── CryptoService.ts
│   │   │   ├── cryptoService.types.ts
│   │   │   └── index.ts
│   │   ├── theme/
│   │   │   ├── ThemeService.ts
│   │   │   ├── themeService.types.ts
│   │   │   └── index.ts
│   │   └── connection/
│   │       ├── ConnectionMonitor.ts
│   │       ├── connectionMonitor.types.ts
│   │       └── index.ts
│   │
│   ├── connectors/                     # Capa de integración externa
│   │   └── etecsa/
│   │       ├── contracts/
│   │       │   ├── IEtecsaConnector.ts
│   │       │   └── types.ts
│   │       ├── strategies/
│   │       │   ├── Strategy.ts                  # Base abstract
│   │       │   ├── KnownEndpointStrategy.ts
│   │       │   ├── DiscoveredEndpointStrategy.ts
│   │       │   ├── ScrapingDomStrategy.ts
│   │       │   ├── ScrapingRegexStrategy.ts
│   │       │   └── ManualFallbackStrategy.ts
│   │       ├── http/
│   │       │   ├── HttpClient.ts
│   │       │   └── httpClient.types.ts
│   │       ├── parsing/
│   │       │   ├── HtmlParser.ts                # Delega a offscreen doc
│   │       │   ├── htmlParser.types.ts
│   │       │   └── OffscreenBridge.ts           # SW → offscreen comm
│   │       ├── errors/
│   │       │   ├── EtecsaError.ts
│   │       │   ├── errorCatalog.ts              # Mensajes español → código
│   │       │   └── errorMapper.ts
│   │       ├── health/
│   │       │   └── HealthReporter.ts
│   │       ├── EtecsaConnector.ts               # Facade
│   │       ├── MockEtecsaConnector.ts           # Para tests/dev
│   │       └── index.ts
│   │
│   ├── providers/                      # React context providers
│   │   ├── ThemeProvider.tsx
│   │   ├── ToastProvider.tsx
│   │   ├── ConfirmProvider.tsx
│   │   └── AppProviders.tsx            # Composición de todos
│   │
│   ├── modules/                        # Módulos transversales
│   │   ├── events/
│   │   │   ├── EventBus.ts
│   │   │   └── eventBus.types.ts
│   │   ├── messaging/
│   │   │   ├── MessageBus.ts           # SW-side handler registry
│   │   │   ├── messageClient.ts        # UI-side sender
│   │   │   └── messages.types.ts
│   │   ├── logging/
│   │   │   ├── Logger.ts
│   │   │   └── sanitize.ts
│   │   └── result/
│   │       └── Result.ts               # Result<T,E> utilities
│   │
│   ├── hooks/                          # Hooks globales reutilizables
│   │   ├── useChromeStorage.ts         # Subscribirse a cambios de storage
│   │   ├── useMessage.ts               # Enviar mensajes al SW
│   │   ├── useTheme.ts
│   │   ├── useToast.ts
│   │   ├── useConfirm.ts
│   │   └── useExtensionVisibility.ts
│   │
│   ├── store/                          # Zustand stores (uno por feature)
│   │   ├── sessionStore.ts
│   │   ├── accountStore.ts
│   │   ├── settingsStore.ts
│   │   ├── schedulerStore.ts
│   │   ├── diagnosticStore.ts
│   │   ├── uiStore.ts
│   │   ├── cryptoStore.ts
│   │   └── middleware/
│   │       ├── storageSync.ts          # Middleware: storage.onChanged → store
│   │       └── devtools.ts             # Zustand devtools
│   │
│   ├── storage/                        # Capa de persistencia
│   │   ├── driver/
│   │   │   ├── chromeStorageDriver.ts  # Wrapper sobre chrome.storage
│   │   │   └── driver.types.ts
│   │   ├── repositories/
│   │   │   ├── AccountRepository.ts
│   │   │   ├── SessionRepository.ts
│   │   │   ├── HistoryRepository.ts
│   │   │   ├── SettingsRepository.ts
│   │   │   ├── SchedulerRepository.ts
│   │   │   ├── LogRepository.ts
│   │   │   └── MetaRepository.ts       # Schema versions, installation id
│   │   ├── schemas/                    # Zod schemas por entidad
│   │   │   ├── accountSchema.ts
│   │   │   ├── sessionSchema.ts
│   │   │   ├── historySchema.ts
│   │   │   ├── settingsSchema.ts
│   │   │   ├── schedulerSchema.ts
│   │   │   ├── logSchema.ts
│   │   │   └── backupSchema.ts
│   │   ├── migrations/
│   │   │   ├── index.ts                # Orquestador de migrations
│   │   │   ├── v1ToV2.ts               # Ejemplo futuro
│   │   │   └── migration.types.ts
│   │   ├── namespaces.ts               # Constantes: nexa.accounts.*, etc.
│   │   └── index.ts
│   │
│   ├── types/                          # Tipos globales (compartidos)
│   │   ├── branded.ts                  # AccountId, SessionId, etc.
│   │   ├── entities.ts                 # Account, Session, Balance, ...
│   │   ├── events.ts                   # ExtensionEvent discriminated union
│   │   ├── messages.ts                 # ExtensionMessage discriminated union
│   │   ├── errors.ts                   # NexaError, NexaErrorCategory
│   │   ├── theme.ts
│   │   ├── connection.ts
│   │   └── index.ts
│   │
│   ├── themes/                         # Definición de temas (CSS variables)
│   │   ├── tokens.css                  # Base :root tokens
│   │   ├── dark.css
│   │   ├── light.css
│   │   ├── nebula.css
│   │   ├── aurora.css
│   │   └── index.css                   # @import all
│   │
│   ├── utils/                          # Utilidades puras (sin side effects)
│   │   ├── time.ts                     # formatDuration, parseHHMMSS, etc.
│   │   ├── crypto.ts                   # Helpers (randomBytes, etc.)
│   │   ├── url.ts                      # URL builders, isCaptivePortalURL
│   │   ├── validation.ts               # Common Zod validators
│   │   ├── format.ts                   # formatCurrency, formatDate
│   │   ├── async.ts                    # retry, withTimeout, sleep
│   │   ├── id.ts                       # uuid, branded id factories
│   │   └── constants.ts                # Endpoints, timeouts, etc.
│   │
│   ├── assets/                         # Assets importables desde código
│   │   ├── icons/                      # SVG source si se customizan
│   │   └── images/
│   │
│   └── styles/                         # Estilos globales
│       ├── globals.css                 # Reset, base styles
│       ├── fonts.css                   # @font-face declarations
│       └── tailwind.css                # Tailwind directives
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   ├── connectors/
│   │   ├── storage/
│   │   └── utils/
│   ├── integration/
│   │   ├── messageBus.test.ts
│   │   ├── storageSync.test.ts
│   │   └── alarms.test.ts
│   ├── fixtures/
│   │   └── etecsa-html/
│   │       ├── login-form-success.html
│   │       ├── login-response-success.html
│   │       ├── login-response-bad-creds.html
│   │       ├── login-response-rate-limited.html
│   │       ├── session-info-with-balance.html
│   │       ├── logout-response.html
│   │       └── online-redirect.html
│   ├── mocks/
│   │   ├── chrome.ts                   # Mock de chrome.* APIs
│   │   └── fetch.ts                    # Mock de fetch para ETECSA
│   └── e2e/
│       └── flows.test.ts
│
├── scripts/
│   ├── build.mjs                       # Build script
│   ├── package.mjs                     # ZIP para distribución
│   ├── validate-manifest.mjs           # Validar manifest antes de build
│   └── download-fonts.mjs              # Descargar/subsetear fuentes
│
├── docs/
│   ├── architecture/                   # Estos documentos
│   │   ├── phase-1/
│   │   └── phase-2/
│   ├── user-guide/                     # Fase 9
│   ├── developer/                      # Fase 9
│   └── changelog/                      # Fase 9
│
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Lint + typecheck + test
│       └── release.yml                 # Build + package + (publish)
│
├── manifest.config.ts                  # Manifest V3 tipado (@crxjs)
├── vite.config.ts                      # Vite + @crxjs plugin
├── tailwind.config.ts                  # Tailwind config
├── tsconfig.json                       # TS config (strict)
├── tsconfig.node.json                  # Para scripts Node
├── package.json
├── pnpm-lock.yaml                      # pnpm preferido (más rápido)
├── .eslintrc.cjs
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .nvmrc                              # Node version pin
├── CHANGELOG.md
├── README.md
├── LICENSE
└── PRIVACY.md                          # Requisito Web Store (D06)
```

---

## 2. Justificación por carpeta

### 2.1 `public/`

Recursos estáticos servidos tal cual por la extensión. **No pasan por Vite** — se copian al `dist/`.

- `icons/`: iconos PNG en múltiples tamaños (Web Store requiere 16, 32, 48, 128) + variantes por estado de sesión (F2-D10).
- `fonts/`: fuentes autohospedadas (regla NEXA — sin Google Fonts CDN). Subsets solo con caracteres necesarios para reducir peso.

### 2.2 `src/app/`

Puntos de entrada. **Uno por surface de la extensión.** Cada uno tiene su propio `index.html` y bootstrap.

- `popup/`: UI del popup (380×520 px).
- `sidepanel/`: UI del SidePanel (full-height, ancho variable).
- `background/`: Service Worker (sin HTML, solo TS).
- `offscreen/`: Offscreen document para HTML parsing (F2-D2).

Cada surface carga solo lo que necesita — code splitting natural.

### 2.3 `src/components/`

Componentes UI **reutilizables entre features**. Tres subniveles:

- `ui/`: componentes shadcn/ui base (Button, Card, Dialog, Input, etc.). Generados vía CLI. No se personalizan más allá de lo que shadcn permite.
- `nexa/`: componentes NEXA custom con branding (NexaLogo, NexaButton, NexaToast, etc.). Aquí vive la identidad visual.
- `layout/`: layouts compuestos (SidePanelLayout, PopupLayout) que combinan `ui/` y `nexa/`.

**Regla**: si un componente se usa en una sola feature, va en `features/{feature}/components/`, no aquí.

### 2.4 `src/features/`

Slices verticales. Cada feature encapsula:

- `components/`: componentes específicos de la feature.
- `hooks/`: hooks específicos de la feature.
- `schema.ts`: Zod schemas de inputs de la feature.

**Features definidas:**

| Feature | Cubre |
|---------|-------|
| `auth` | Login, logout, reconnect, connection status UI |
| `accounts` | CRUD de cuentas, selección, badges de tipo |
| `dashboard` | Vista principal del SidePanel con cards y gráficos |
| `scheduler` | Programación de desconexiones |
| `settings` | Todas las configuraciones (apariencia, comportamiento, notificaciones, seguridad, backup) |
| `developer` | Developer Mode completo (logs, inspectors, tools) |
| `onboarding` | Setup inicial (crear master password) |
| `unlock` | Pantalla de unlock (ingresar master password) |

### 2.5 `src/services/`

Lógica de aplicación. Servicios **stateless** que viven en el SW. Uno por dominio.

Cada servicio tiene:
- `{Name}.ts`: implementación.
- `{name}.types.ts`: interfaces y tipos del servicio.
- `index.ts`: barrel export.

**Servicios definidos** (detalle en Documento 3):
- `SessionManager`, `AccountManager`, `SchedulerEngine`, `NotificationEngine`, `StorageEngine`, `DiagnosticEngine`, `CryptoService`, `ThemeService`, `ConnectionMonitor`.

### 2.6 `src/connectors/`

Capa de integración externa. Aislada del resto. Definida en Fase 1 (Doc 2) y refinada en Fase 2.

Solo `etecsa/` existe en Fase 1-9. La estructura prepara para futuros connectors NEXA.

### 2.7 `src/providers/`

React Context providers para cross-cutting concerns en UI.

- `ThemeProvider`: aplica `data-theme` attribute.
- `ToastProvider`: expone `useToast()` para mostrar toasts NEXA.
- `ConfirmProvider`: expone `useConfirm()` para diálogos de confirmación.
- `AppProviders`: composición para envolver App de popup/sidepanel.

### 2.8 `src/modules/`

Módulos transversales **no UI**. Usados por servicios y connectors.

- `events/`: `EventBus` interno del SW.
- `messaging/`: `MessageBus` (SW handler registry) + `messageClient` (UI sender).
- `logging/`: `Logger` con sanitización.
- `result/`: tipo `Result<T,E>` + utilidades (`map`, `flatMap`, `unwrap`).

### 2.9 `src/hooks/`

Hooks globales reutilizables en múltiples features.

**Regla**: si un hook se usa solo en una feature, va en `features/{feature}/hooks/`. Si se usa en 2+ features, se promueve aquí.

### 2.10 `src/store/`

Zustand stores. **Uno por feature o dominio de estado.** Más un middleware de sincronización con storage.

- `middleware/storageSync.ts`: suscribe a `chrome.storage.onChanged` y actualiza store.
- `middleware/devtools.ts`: integra con Redux DevTools para debugging.

### 2.11 `src/storage/`

Capa de persistencia. **Abstracción sobre `chrome.storage.local`.**

- `driver/`: wrapper tipado sobre `chrome.storage`.
- `repositories/`: uno por entidad, expone CRUD tipado.
- `schemas/`: Zod schemas para validar datos leídos de storage.
- `migrations/`: funciones de migración entre versiones de schema (F2-D13).
- `namespaces.ts`: constantes de keys (ej: `nexa.accounts.${id}`).

**Regla**: ningún servicio accede a `chrome.storage` directamente — siempre via Repository.

### 2.12 `src/types/`

Tipos **globales** compartidos entre múltiples capas. Tipos específicos de un módulo viven con ese módulo.

- `branded.ts`: tipos branded (AccountId, SessionId, etc.) — defensiva contra bugs.
- `entities.ts`: entidades de dominio (Account, Session, Balance, ...).
- `events.ts`: `ExtensionEvent` discriminated union.
- `messages.ts`: `ExtensionMessage` discriminated union.
- `errors.ts`: `NexaError`, `NexaErrorCategory`.

### 2.13 `src/themes/`

Definiciones de temas como CSS variables. **Un archivo por tema.**

`tokens.css` define la base (default). Cada tema overridea con `:root[data-theme="..."]`.

### 2.14 `src/utils/`

Funciones puras sin side effects. Importables desde cualquier capa.

- `time.ts`: parsing de `HH:MM:SS`, formateo de duraciones.
- `crypto.ts`: helpers (randomBytes, constantTimeCompare).
- `url.ts`: builders de URLs ETECSA, detección de captive portal.
- `validation.ts`: Zod validators comunes.
- `async.ts`: `retry`, `withTimeout`, `sleep`.
- `id.ts`: generación de IDs branded.
- `constants.ts`: timeouts, límites, endpoints.

### 2.15 `tests/`

Estructura mirror de `src/` para tests unitarios. Carpeta separada para integration, e2e, fixtures y mocks.

### 2.16 `scripts/`

Scripts de build y tooling. **No se incluyen en el bundle de la extensión.**

### 2.17 `docs/`

Documentación por fase + user guide + developer docs (Fase 9).

---

## 3. Convenciones de Naming

### 3.1 Archivos

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Componente React | `PascalCase.tsx` | `NexaButton.tsx`, `LoginForm.tsx` |
| Servicio | `PascalCase.ts` | `SessionManager.ts` |
| Tipo/Interface | `camelCase.types.ts` | `sessionManager.types.ts` |
| Store | `camelCaseStore.ts` | `sessionStore.ts` |
| Hook | `useXxx.ts` | `useLogin.ts` |
| Schema Zod | `camelCaseSchema.ts` | `accountSchema.ts` |
| Repository | `PascalCase.ts` | `AccountRepository.ts` |
| Test | `xxx.test.ts` | `SessionManager.test.ts` |
| Fixture | `kebab-case.html` | `login-form-success.html` |

### 3.2 Carpetas

- Siempre `kebab-case` para carpetas.
- Singular para categorías (`component`, `service`) — pero usamos `components`, `services` (plural) por convención de React ecosystem.

### 3.3 Tipos

| Categoría | Sufijo | Ejemplo |
|-----------|--------|---------|
| Interface | sin sufijo o `Interface` | `SessionManager` o `ISessionManager` |
| Type alias | sin sufijo | `SessionData`, `AccountId` |
| Enum-like union | sin sufijo | `ConnectionState`, `EtecsaErrorCode` |
| Input/Output | `Input` / `Output` / `Response` | `LoginInput`, `BalanceResponse` |
| Props | `Props` | `NexaButtonProps` |

> Decisión: **no usar prefijo `I`** en interfaces (viene de C#/.NET; TS moderno lo desaconseja). Excepción: `IEtecsaConnector` se mantiene por convención del connector layer (Fase 1).

---

## 4. Path Aliases (F2-D15)

Configurados en `tsconfig.json` y `vite.config.ts`:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/features/*": ["src/features/*"],
      "@/services/*": ["src/services/*"],
      "@/connectors/*": ["src/connectors/*"],
      "@/store/*": ["src/store/*"],
      "@/storage/*": ["src/storage/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/modules/*": ["src/modules/*"],
      "@/providers/*": ["src/providers/*"],
      "@/themes/*": ["src/themes/*"],
      "@/assets/*": ["src/assets/*"]
    }
  }
}
```

```typescript
// Uso
import { SessionManager } from '@/services/session';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { NexaButton } from '@/components/nexa/NexaButton';
import { AccountId } from '@/types/branded';
```

---

## 5. Reglas de Cohesión

### 5.1 Dependencias permitidas

```
UI (popup, sidepanel)
   ↓ puede importar de
features, components, hooks, store, providers, utils, types

features
   ↓ puede importar de
components, hooks, store, services, utils, types

services
   ↓ puede importar de
connectors, storage, modules, utils, types

connectors
   ↓ puede importar de
modules, utils, types
   (NO services — connectors son la capa más baja)

store
   ↓ puede importar de
types, utils
   (NO services — store es vista)

storage
   ↓ puede importar de
modules, utils, types
```

### 5.2 Dependencias prohibidas

| From | To | Razón |
|------|----|----|
| services | store | Store es vista; services no leen estado de UI. |
| connectors | services | Connector es capa más baja; no conoce services. |
| storage | services | Storage no conoce lógica de aplicación. |
| UI | services directamente | UI debe ir via message bus. Excepción: hooks dentro de `services` son OK si son de UI-side. |
| UI | connectors directamente | Prohibido — viola separación de capas. |
| UI | storage directamente | UI usa Zustand stores, no storage. |

### 5.3 ESLint enforcement

Configuramos `eslint-plugin-import` con reglas `no-restricted-paths` para hacer cumplir estas reglas en build time:

```javascript
// .eslintrc.cjs (extracto)
'no-restricted-paths': ['error', {
  zones: [
    { target: './src/connectors', from: './src/services' },
    { target: './src/connectors', from: './src/features' },
    { target: './src/connectors', from: './src/components' },
    { target: './src/storage', from: './src/services' },
    { target: './src/store', from: './src/services' },
    // ...
  ]
}]
```

---

## 6. Configuración de Build

### 6.1 `manifest.config.ts`

```typescript
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'NEXA NautaX',
  short_name: 'NautaX',
  version: '1.0.0',
  description: 'Administración premium de cuentas Nauta ETECSA',
  default_locale: 'es',
  
  action: {
    default_popup: 'src/app/popup/index.html',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png',
    },
  },
  
  background: {
    service_worker: 'src/app/background/service-worker.ts',
    type: 'module',
  },
  
  side_panel: {
    default_path: 'src/app/sidepanel/index.html',
  },
  
  permissions: [
    'storage',
    'alarms',
    'sidePanel',
    'offscreen',
  ],
  
  host_permissions: [
    'https://secure.etecsa.net:8443/*',
  ],
  
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'",
  },
  
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
});
```

### 6.2 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import tailwindcss from 'tailwindcss';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/app/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/app/sidepanel/index.html'),
        offscreen: resolve(__dirname, 'src/app/offscreen/index.html'),
      },
    },
  },
});
```

### 6.3 `tsconfig.json` (extracto)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "paths": { /* ver §4 */ }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

> `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` son máximos de strict mode. Pueden generar fricción inicial pero detectan bugs reales.

---

## 7. Anti-patrones de organización

### 7.1 Lo que NO debe haber

| Antipatrón | Por qué está mal |
|------------|------------------|
| Archivo `utils.ts` gigante | Se convierte en basurero. Si crece, dividir por categoría. |
| Carpeta `helpers/` | Sinónimo vago de `utils/`. Usar `utils/`. |
| Componentes en `components/` usados por una sola feature | Van en `features/{feature}/components/`. |
| Tipos dispersos en cada archivo | Tipos compartidos en `types/`; tipos locales pueden quedar en el archivo. |
| Importaciones relativas profundas (`../../../`) | Usar path aliases siempre. |
| Archivos `index.ts` que re-exportan todo | Solo para barrels de services/connectors, no para components. |
| Componentes con lógica de negocio | Extraer a hooks o services. |
| Servicios con imports de React | Servicios son SW-side; no conocen React. |
| Stores con lógica asíncrona | Stores son sincrónicos; async va en hooks o services. |

### 7.2 Tamaños máximos recomendados

| Tipo de archivo | Máximo | Si supera |
|-----------------|--------|-----------|
| Componente React | 200 líneas | Dividir en subcomponentes |
| Hook | 100 líneas | Dividir en hooks más pequeños |
| Servicio | 400 líneas | Dividir en sub-servicios o helpers |
| Test | 300 líneas | Dividir por `describe` blocks |
| Tipo file | sin límite | — |

Estas son **recomendaciones de código review**, no reglas automáticas.

---

## 8. Workspace vs Monorepo

**Decisión**: NEXA NautaX es un **single package** (no monorepo) en Fase 1-9.

Cuando llegue el segundo producto NEXA (Downloader, Browser, etc.), evaluaremos migrar a **pnpm workspace** con packages compartidos:

```
nexa-ecosystem/
├── packages/
│   ├── shared/         # modules/crypto, modules/events, modules/logging
│   ├── ui/             # components/nexa, themes
│   └── types/          # branded, errors
├── apps/
│   ├── nautax/         # este proyecto
│   ├── downloader/     # futuro
│   └── browser/        # futuro
└── pnpm-workspace.yaml
```

**No lo hacemos ahora** — sobre-ingeniería prematura. La estructura actual ya prepara el camino al mantener `modules/`, `connectors/`, `types/` aislados.

---

## 9. Versionado de archivos

- Usamos **git** con conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Branch principal: `main`.
- Branches de feature: `feat/phase-X-...`, `fix/...`.
- Tags: `v1.0.0`, `v1.0.1`, etc. (Semantic Versioning, Fase 9).

---

## 10. Pendientes para Fases siguientes

- **Fase 3**: llenar `components/nexa/`, `themes/`, definir design tokens.
- **Fase 4**: llenar `storage/schemas/`, `storage/repositories/`, `types/entities.ts`.
- **Fase 5**: crear el proyecto base con esta estructura (esqueletos vacíos).
- **Fase 6**: llenar `connectors/etecsa/` con implementación real.
- **Fase 7**: llenar `features/*/components/` con UI completa.
- **Fase 8**: llenar `tests/` con cobertura completa.
- **Fase 9**: llenar `docs/` con user guide y developer docs.

---

**Fin del Documento 2.**
Continúa en `03-service-layer-design.md`.
