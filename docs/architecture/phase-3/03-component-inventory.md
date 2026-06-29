# NEXA NautaX — Component Inventory

**Fase:** 3
**Documento:** 3 de 4
**Autor:** Arquitecto NEXA NautaX + Designer UI
**Fecha:** 2026-06-22

> Lista completa de componentes UI a implementar en Fases 5 y 7. Organizado por categoría con props, variantes y dependencias.

---

## 1. Convenciones

### 1.1 Categorías

| Categoría | Prefijo | Ubicación |
|-----------|---------|-----------|
| NEXA branded | `Nexa` | `src/components/nexa/` |
| shadcn/ui base | (sin prefijo) | `src/components/ui/` |
| Layout | `Layout`, `Panel`, `Header` | `src/components/layout/` |
| Feature-specific | (libre) | `src/features/{feature}/components/` |

### 1.2 Estructura de cada entrada

```
### ComponentName
- **Ubicación**: ruta
- **Categoría**: nexa | ui | layout | feature
- **Descripción**: 1-2 líneas
- **Props**:
  - `prop1: type` — descripción
  - `prop2?: type` — descripción (opcional)
- **Variantes**: lista
- **Estados**: lista
- **Dependencias**: otros componentes
- **Usado en**: features/screens
```

---

## 2. Componentes NEXA (branded)

### 2.1 NexaLogo

- **Ubicación**: `src/components/nexa/NexaLogo.tsx`
- **Categoría**: nexa
- **Descripción**: Logo NEXA NautaX — composición de "NEXA" + "NautaX" con tipografía Syne.
- **Props**:
  - `size?: 'sm' | 'md' | 'lg' | 'xl'` — default 'md'
  - `variant?: 'full' | 'icon' | 'wordmark'` — default 'full'
  - `withIcon?: boolean` — default true (cuadrado con N estilizada)
- **Variantes**:
  - `full`: icono + "NEXA" + "NautaX" (horizontal)
  - `icon`: solo el cuadrado con N
  - `wordmark`: solo texto "NEXA NautaX"
- **Tamaños**:
  - sm: texto 16px, icono 20px
  - md: texto 20px, icono 24px
  - lg: texto 24px, icono 32px
  - xl: texto 32px, icono 40px
- **Dependencias**: Syne font
- **Usado en**: Popup header, SidePanel header, Onboarding screens

### 2.2 NexaButton

- **Ubicación**: `src/components/nexa/NexaButton.tsx`
- **Categoría**: nexa
- **Descripción**: Botón NEXA con variantes premium. Wrapper sobre shadcn Button con ajustes de branding.
- **Props**:
  - `variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'`
  - `size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'`
  - `loading?: boolean` — muestra spinner
  - `icon?: ReactNode` — icono a la izquierda
  - `iconRight?: ReactNode` — icono a la derecha
  - `fullWidth?: boolean`
  - Hereda todas las props de `<button>`
- **Variantes**: ver Design System §6.1
- **Estados**: default, hover, active, focus, disabled, loading
- **Dependencias**: `Spinner`, `lucide-react`
- **Usado en**: prácticamente todas las screens

### 2.3 NexaCard

- **Ubicación**: `src/components/nexa/NexaCard.tsx`
- **Categoría**: nexa
- **Descripción**: Card NEXA con header/body/footer opcionales.
- **Props**:
  - `variant?: 'default' | 'elevated' | 'interactive' | 'outline'`
  - `header?: ReactNode`
  - `footer?: ReactNode`
  - `padding?: 'sm' | 'md' | 'lg' | 'none'`
  - `as?: 'div' | 'button'` — si es button, se vuelve interactive
  - `onClick?: () => void`
- **Variantes**: ver Design System §6.2
- **Estados**: default, hover (interactive), active (interactive), focus
- **Dependencias**: ninguna
- **Usado en**: Dashboard cards, Account cards, Settings sections, Developer cards

### 2.4 NexaStatusIndicator

- **Ubicación**: `src/components/nexa/NexaStatusIndicator.tsx`
- **Categoría**: nexa
- **Descripción**: Indicador de estado de conexión con dot pulsante + label + icono.
- **Props**:
  - `status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'offline' | 'expired' | 'error' | 'no-account'`
  - `size?: 'sm' | 'md' | 'lg'`
  - `showIcon?: boolean` — default true
  - `showLabel?: boolean` — default true
  - `pulse?: boolean` — default true para connecting/reconnecting
- **Variantes por status**:
  | Status | Color | Label | Icon |
  |--------|-------|-------|------|
  | connected | success | "Conectado" | Wifi |
  | disconnected | subtle | "Desconectado" | WifiOff |
  | connecting | warning (pulse) | "Conectando..." | Loader2 spin |
  | reconnecting | warning (pulse) | "Reconectando..." | RefreshCw spin |
  | offline | subtle | "Sin conexión" | WifiOff |
  | expired | warning | "Sesión expirada" | Clock |
  | error | error | "Error" | AlertCircle |
  | no-account | subtle | "Sin cuenta" | UserX |
- **Dependencias**: `lucide-react`
- **Usado en**: Popup, SidePanel header, Dashboard, Account cards

### 2.5 NexaToast

- **Ubicación**: `src/components/nexa/NexaToast.tsx`
- **Categoría**: nexa
- **Descripción**: Toast individual NEXA. Renderizado por NexaToastContainer.
- **Props**:
  - `id: string`
  - `variant: 'success' | 'error' | 'warning' | 'info'`
  - `title: string`
  - `message?: string`
  - `action?: { label: string; onClick: () => void }`
  - `duration?: number` — default según variante
  - `persistent?: boolean`
  - `onDismiss: (id: string) => void`
- **Variantes**: ver Design System §6.4
- **Estados**: appearing, visible, dismissing, hover (pausa auto-dismiss)
- **Dependencias**: `lucide-react`
- **Usado en**: NexaToastContainer

### 2.6 NexaToastContainer

- **Ubicación**: `src/components/nexa/NexaToastContainer.tsx`
- **Categoría**: nexa
- **Descripción**: Container fijo que muestra toasts activos. Se suscribe a notification store.
- **Props**: ninguno — se conecta al notificationEngine via storage events
- **Comportamiento**:
  - Posición: top-right
  - Stack vertical, máx 3 visibles
  - Anima entrada/salida
- **Dependencias**: `NexaToast`, `useNotificationStore`
- **Usado en**: PopupLayout, SidePanelLayout (uno por surface)

### 2.7 NexaSpinner

- **Ubicación**: `src/components/nexa/NexaSpinner.tsx`
- **Categoría**: nexa
- **Descripción**: Spinner circular SVG con animación rotate.
- **Props**:
  - `size?: 'xs' | 'sm' | 'md' | 'lg'` — 12/16/20/24px
  - `color?: string` — default `currentColor`
- **Estados**: spinning (siempre)
- **Dependencias**: ninguna
- **Usado en**: Buttons loading, full-page loading, inline loading

### 2.8 NexaBanner

- **Ubicación**: `src/components/nexa/NexaBanner.tsx`
- **Categoría**: nexa
- **Descripción**: Banner contextual para mensajes importantes (offline, warning, etc.).
- **Props**:
  - `variant: 'info' | 'warning' | 'error' | 'success'`
  - `title: string`
  - `message?: string`
  - `action?: { label: string; onClick: () => void }`
  - `dismissible?: boolean`
  - `onDismiss?: () => void`
- **Dependencias**: `lucide-react`
- **Usado en**: Popup (offline banner), SidePanel (contextual warnings)

### 2.9 NexaEmptyState

- **Ubicación**: `src/components/nexa/NexaEmptyState.tsx`
- **Categoría**: nexa
- **Descripción**: Estado vacío con icono, título, descripción y CTA opcional.
- **Props**:
  - `icon: ReactNode` — típicamente icono lucide 48px
  - `title: string`
  - `description?: string`
  - `action?: { label: string; onClick: () => void }`
- **Dependencias**: ninguna
- **Usado en**: Accounts (sin cuentas), History (sin historial), Logs (sin logs)

### 2.10 NexaConfirmDialog

- **Ubicación**: `src/components/nexa/NexaConfirmDialog.tsx`
- **Categoría**: nexa
- **Descripción**: Dialog de confirmación para acciones destructivas. Soporta confirmación por texto.
- **Props**:
  - `open: boolean`
  - `onClose: () => void`
  - `onConfirm: () => void`
  - `title: string`
  - `description?: string`
  - `confirmLabel?: string` — default "Confirmar"
  - `cancelLabel?: string` — default "Cancelar"
  - `variant?: 'default' | 'danger'`
  - `requireText?: string` — si se setea, requiere escribir este texto para habilitar botón
  - `loading?: boolean`
- **Dependencias**: shadcn Dialog, NexaButton, NexaInput
- **Usado en**: Delete account, Reset extension, Clear logs

### 2.11 NexaInput

- **Ubicación**: `src/components/nexa/NexaInput.tsx`
- **Categoría**: nexa
- **Descripción**: Input NEXA con label, hint, error, icono opcional.
- **Props**:
  - `label?: string`
  - `hint?: string`
  - `error?: string`
  - `icon?: ReactNode` — icono a la izquierda dentro del input
  - `rightSlot?: ReactNode` — botón a la derecha (ej: toggle password)
  - Todas las props de `<input>`
- **Estados**: default, hover, focus, error, disabled
- **Dependencias**: ninguna
- **Usado en**: Forms de login, cuenta, settings

### 2.12 NexaPasswordInput

- **Ubicación**: `src/components/nexa/NexaPasswordInput.tsx`
- **Categoría**: nexa
- **Descripción**: Input de contraseña con botón mostrar/ocultar.
- **Props**:
  - Hereda NexaInput
  - `showStrength?: boolean` — muestra medidor de fortaleza (para master password)
  - `strength?: 'weak' | 'medium' | 'strong' | 'very-strong'`
- **Dependencias**: NexaInput, `lucide-react` (Eye, EyeOff)
- **Usado en**: LoginForm, AccountFormDialog, Onboarding, UnlockScreen

### 2.13 NexaBadge

- **Ubicación**: `src/components/nexa/NexaBadge.tsx`
- **Categoría**: nexa
- **Descripción**: Badge para metadata compacta.
- **Props**:
  - `variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline'`
  - `size?: 'sm' | 'md'`
  - `icon?: ReactNode`
- **Dependencias**: ninguna
- **Usado en**: AccountTypeBadge, StatusBadge, SchedulerBadge

### 2.14 NexaSelect

- **Ubicación**: `src/components/nexa/NexaSelect.tsx`
- **Categoría**: nexa
- **Descripción**: Select NEXA sobre shadcn Select.
- **Props**:
  - `label?: string`
  - `hint?: string`
  - `error?: string`
  - `options: Array<{ value: string; label: string; icon?: ReactNode }>`
  - `value?: string`
  - `onChange: (value: string) => void`
  - `searchable?: boolean` — default false
  - `placeholder?: string`
- **Dependencias**: shadcn Select
- **Usado en**: AccountFormDialog (tipo de cuenta), Settings, Scheduler

### 2.15 NexaSwitch

- **Ubicación**: `src/components/nexa/NexaSwitch.tsx`
- **Categoría**: nexa
- **Descripción**: Toggle switch NEXA.
- **Props**:
  - `label?: string`
  - `description?: string`
  - `checked: boolean`
  - `onChange: (checked: boolean) => void`
  - `disabled?: boolean`
- **Dependencias**: shadcn Switch
- **Usado en**: Settings (todas las secciones), AccountFormDialog (reconnect policy)

### 2.16 NexaTabs

- **Ubicación**: `src/components/nexa/NexaTabs.tsx`
- **Categoría**: nexa
- **Descripción**: Tabs con underline style NEXA.
- **Props**:
  - `tabs: Array<{ id: string; label: string; icon?: ReactNode; content: ReactNode }>`
  - `activeTab: string`
  - `onChange: (id: string) => void`
- **Dependencias**: ninguna
- **Usado en**: Settings, Developer Mode

### 2.17 NexaStatCard

- **Ubicación**: `src/components/nexa/NexaStatCard.tsx`
- **Categoría**: nexa
- **Descripción**: Card de estadística con valor grande + label + icono.
- **Props**:
  - `label: string`
  - `value: string | number`
  - `icon?: ReactNode`
  - `trend?: { direction: 'up' | 'down'; value: string }` — opcional
  - `color?: 'default' | 'success' | 'warning' | 'error'`
  - `loading?: boolean`
- **Dependencias**: NexaSpinner, Skeleton
- **Usado en**: Dashboard (time, balance, sessions count, etc.)

### 2.18 NexaTimeDisplay

- **Ubicación**: `src/components/nexa/NexaTimeDisplay.tsx`
- **Categoría**: nexa
- **Descripción**: Display de tiempo formateado (HH:MM:SS) con animación al cambiar.
- **Props**:
  - `durationMs: number`
  - `format?: 'hhmmss' | 'mmss' | 'human'`
  - `size?: 'sm' | 'md' | 'lg' | 'xl'`
  - `monospace?: boolean` — default true (JetBrainsMono)
- **Dependencias**: util `time.ts`
- **Usado en**: Popup (tiempo conectado), Dashboard, Scheduler

### 2.19 NexaBalanceDisplay

- **Ubicación**: `src/components/nexa/NexaBalanceDisplay.tsx`
- **Categoría**: nexa
- **Descripción**: Display de saldo con moneda y animación.
- **Props**:
  - `amount: number`
  - `currency?: string` — default 'CUP'
  - `size?: 'sm' | 'md' | 'lg' | 'xl'`
  - `lowBalance?: boolean` — aplica estilo warning
  - `loading?: boolean`
- **Dependencias**: util `format.ts`
- **Usado en**: Popup, Dashboard, Account cards

### 2.20 NexaIcon

- **Ubicación**: `src/components/nexa/NexaIcon.tsx`
- **Categoría**: nexa
- **Descripción**: Wrapper sobre lucide-react icon con tamaños estandarizados.
- **Props**:
  - `name: LucideIcon`
  - `size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` — 12/14/16/18/20px
  - `color?: string` — default currentColor
  - `strokeWidth?: number` — default 2
- **Dependencias**: `lucide-react`
- **Usado en**: prácticamente todos los componentes

### 2.21 NexaCodeBlock

- **Ubicación**: `src/components/nexa/NexaCodeBlock.tsx`
- **Categoría**: nexa
- **Descripción**: Bloque de código monoespaciado para Developer Mode.
- **Props**:
  - `content: string`
  - `language?: 'json' | 'text' | 'http'`
  - `lineNumbers?: boolean`
  - `maxHeight?: number`
  - `copyable?: boolean` — botón copiar
- **Dependencias**: JetBrainsMono font, `lucide-react` (Copy)
- **Usado en**: Developer Mode (logs, network records, JSON viewer)

### 2.22 NexaKeyValue

- **Ubicación**: `src/components/nexa/NexaKeyValue.tsx`
- **Categoría**: nexa
- **Descripción**: Display key-value horizontal o vertical.
- **Props**:
  - `label: string`
  - `value: ReactNode`
  - `orientation?: 'horizontal' | 'vertical'`
  - `mono?: boolean` — usa JetBrainsMono
  - `copyable?: boolean`
- **Dependencias**: ninguna
- **Usado en**: Developer Mode, Account details, Session info

### 2.23 NexaList

- **Ubicación**: `src/components/nexa/NexaList.tsx`
- **Categoría**: nexa
- **Descripción**: Lista virtualizada para grandes conjuntos de datos (logs, history).
- **Props**:
  - `items: T[]`
  - `renderItem: (item: T, index: number) => ReactNode`
  - `itemHeight: number`
  - `maxHeight: number`
  - `emptyState?: ReactNode`
  - `onEndReached?: () => void` — para paginación
- **Dependencias**: `react-virtual` (futuro) o implementación custom
- **Usado en**: LogsViewer, NetworkDebugPanel, HistoryList

---

## 3. Componentes shadcn/ui base

### 3.1 Lista de componentes a generar vía CLI

| Componente | Uso en NEXA |
|------------|-------------|
| `button` | Base para NexaButton |
| `card` | Base para NexaCard |
| `dialog` | Base para NexaConfirmDialog y modales custom |
| `input` | Base para NexaInput |
| `select` | Base para NexaSelect |
| `switch` | Base para NexaSwitch |
| `tabs` | Base para NexaTabs |
| `tooltip` | Hints en iconos y acciones |
| `popover` | Menús contextuales |
| `dropdown-menu` | Menús de acciones (account options, dev tools) |
| `separator` | Dividers |
| `scroll-area` | SidePanel scroll, lists |
| `avatar` | Account avatar (placeholder, sin imagen real) |
| `progress` | Loading bars, balance progress |
| `skeleton` | Loading states |
| `label` | Form labels |

> **No** generar todos de antemano — solo los que se necesiten. shadcn CLI es "copy-paste" por componente.

### 3.2 Personalización

Cada componente shadcn se personaliza para usar CSS variables de NEXA (no las defaults de shadcn). Esto se hace en `tailwind.config.ts`:

```typescript
// Extracto
colors: {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
  // ... etc
}
```

---

## 4. Componentes de Layout

### 4.1 PopupLayout

- **Ubicación**: `src/components/layout/PopupLayout.tsx`
- **Descripción**: Layout base del popup.
- **Estructura**: Header (48px) + Content (flex-1) + Footer (40px)
- **Props**:
  - `header?: ReactNode` — default: NexaLogo + theme toggle
  - `footer?: ReactNode` — default: status indicator compacto
  - `children: ReactNode`
- **Dependencias**: NexaToastContainer

### 4.2 SidePanelLayout

- **Ubicación**: `src/components/layout/SidePanelLayout.tsx`
- **Descripción**: Layout base del SidePanel con nav lateral.
- **Estructura**: Header (56px) + Nav (64px width) + Content (flex-1) + Footer (40px)
- **Props**:
  - `activeView: SidePanelView`
  - `onViewChange: (view: SidePanelView) => void`
  - `children: ReactNode`
- **Tipo**:
  ```typescript
  type SidePanelView =
    | 'dashboard' | 'accounts' | 'scheduler'
    | 'settings' | 'developer';
  ```
- **Dependencias**: SidePanelHeader, SidePanelNav, SidePanelFooter, NexaToastContainer

### 4.3 SidePanelHeader

- **Ubicación**: `src/components/layout/SidePanelHeader.tsx`
- **Descripción**: Header del SidePanel con logo y acciones.
- **Contenido**: NexaLogo + theme toggle + connection status compacto

### 4.4 SidePanelNav

- **Ubicación**: `src/components/layout/SidePanelNav.tsx`
- **Descripción**: Navegación lateral con 5 items.
- **Props**:
  - `active: SidePanelView`
  - `onChange: (view: SidePanelView) => void`
- **Items**:
  - Dashboard (icon: LayoutDashboard)
  - Accounts (icon: Users)
  - Scheduler (icon: Calendar)
  - Settings (icon: Settings)
  - Developer (icon: Terminal)

### 4.5 SidePanelFooter

- **Ubicación**: `src/components/layout/SidePanelFooter.tsx`
- **Descripción**: Footer con status de conexión compacto.
- **Contenido**: NexaStatusIndicator (sm) + version

---

## 5. Componentes de Feature — Auth

### 5.1 LoginForm

- **Ubicación**: `src/features/auth/components/LoginForm.tsx`
- **Descripción**: Formulario de login completo.
- **Props**:
  - `onSubmit: (credentials) => void`
  - `loading?: boolean`
  - `error?: NexaError`
- **Campos**:
  - Select de cuenta (si > 1 cuenta) o display de cuenta única
  - NexaPasswordInput (si "recordar contraseña" desactivado o no hay guardada)
  - NexaSwitch "Recordar contraseña"
  - NexaButton "Conectar"
- **Validación**: Zod schema
- **Estados**: idle, loading, error
- **Dependencias**: NexaInput, NexaPasswordInput, NexaButton, NexaSelect, NexaSwitch

### 5.2 LogoutButton

- **Ubicación**: `src/features/auth/components/LogoutButton.tsx`
- **Descripción**: Botón de logout con confirmación si hay scheduler tasks activas.
- **Props**:
  - `onLogout: () => void`
  - `loading?: boolean`
- **Dependencias**: NexaButton, NexaConfirmDialog

### 5.3 ConnectionStatusCard

- **Ubicación**: `src/features/auth/components/ConnectionStatusCard.tsx`
- **Descripción**: Card con estado de conexión + info de sesión.
- **Contenido**:
  - NexaStatusIndicator
  - Cuenta activa
  - Tiempo conectado (NexaTimeDisplay)
  - Última sincronización
- **Dependencias**: NexaCard, NexaStatusIndicator, NexaKeyValue

### 5.4 ReconnectButton

- **Ubicación**: `src/features/auth/components/ReconnectButton.tsx`
- **Descripción**: Botón de reconexión manual.
- **Props**:
  - `onReconnect: () => void`
  - `loading?: boolean`
  - `attemptInfo?: { current: number; max: number }` — muestra "Intento X de Y"

---

## 6. Componentes de Feature — Accounts

### 6.1 AccountList

- **Ubicación**: `src/features/accounts/components/AccountList.tsx`
- **Descripción**: Lista/grid de cuentas guardadas.
- **Props**:
  - `accounts: Account[]`
  - `selectedId?: AccountId`
  - `onSelect: (id: AccountId) => void`
  - `onEdit: (id: AccountId) => void`
  - `onDelete: (id: AccountId) => void`
  - `onAdd: () => void`
- **Estados**: empty (NexaEmptyState), single, multiple
- **Dependencias**: AccountCard, NexaEmptyState, NexaButton

### 6.2 AccountCard

- **Ubicación**: `src/features/accounts/components/AccountCard.tsx`
- **Descripción**: Card individual de cuenta.
- **Props**:
  - `account: Account`
  - `selected?: boolean`
  - `active?: boolean` — tiene sesión activa
  - `onSelect: () => void`
  - `onEdit: () => void`
  - `onDelete: () => void`
- **Contenido**:
  - Alias (Syne, lg)
  - Username (mono, sm)
  - AccountTypeBadge
  - Last used (relative time)
  - Status badge (activa/inactiva)
  - Acciones: edit, delete (en dropdown menu)
- **Dependencias**: NexaCard, NexaBadge, AccountTypeBadge, dropdown-menu

### 6.3 AccountTypeBadge

- **Ubicación**: `src/features/accounts/components/AccountTypeBadge.tsx`
- **Descripción**: Badge de tipo de cuenta.
- **Props**:
  - `type: 'prepaid'`
- **Variantes**:
  | Type | Label | Color |
  |------|-------|-------|
  | prepaid | "Prepago" | primary |
- **Dependencias**: NexaBadge

### 6.4 AccountFormDialog

- **Ubicación**: `src/features/accounts/components/AccountFormDialog.tsx`
- **Descripción**: Modal para crear/editar cuenta.
- **Props**:
  - `open: boolean`
  - `onClose: () => void`
  - `onSubmit: (input: NewAccountInput | AccountUpdateInput) => void`
  - `account?: Account` — si se pasa, es edit mode
  - `loading?: boolean`
  - `error?: NexaError`
- **Campos**:
  - Alias (NexaInput)
  - Username (NexaInput, con sugerencia de sufijo)
  - Password (NexaPasswordInput)
  - Type (NexaSelect — solo prepago en Fase 1)
  - Reconnect policy (NexaSwitch + sub-opciones)
  - Verify credentials checkbox (NexaSwitch)
- **Validación**: Zod schema en `features/accounts/schema.ts`
- **Estados**: idle, verifying, error
- **Dependencias**: NexaCard, NexaInput, NexaPasswordInput, NexaSelect, NexaSwitch, NexaButton

### 6.5 AccountDeleteDialog

- **Ubicación**: `src/features/accounts/components/AccountDeleteDialog.tsx`
- **Descripción**: Confirmación de eliminación de cuenta.
- **Props**:
  - `open: boolean`
  - `account: Account | null`
  - `onClose: () => void`
  - `onConfirm: () => void`
  - `loading?: boolean`
- **Comportamiento**: requiere escribir "ELIMINAR"
- **Dependencias**: NexaConfirmDialog

---

## 7. Componentes de Feature — Dashboard

### 7.1 DashboardOverview

- **Ubicación**: `src/features/dashboard/components/DashboardOverview.tsx`
- **Descripción**: Vista principal del dashboard.
- **Contenido**:
  - ActiveSessionCard (o NexaEmptyState si no hay sesión)
  - Grid de stat cards (Balance, Time, Sessions count)
  - UsageChart
  - LastSessionsList
- **Dependencias**: ActiveSessionCard, NexaStatCard, UsageChart, LastSessionsList

### 7.2 ActiveSessionCard

- **Ubicación**: `src/features/dashboard/components/ActiveSessionCard.tsx`
- **Descripción**: Card grande con info de sesión activa.
- **Contenido**:
  - NexaStatusIndicator (lg)
  - Cuenta activa (username, alias)
  - Tiempo conectado (NexaTimeDisplay xl)
  - Saldo (NexaBalanceDisplay)
  - Botones: Logout, Refresh
- **Estados**: active, loading, error

### 7.3 BalanceCard

- **Ubicación**: `src/features/dashboard/components/BalanceCard.tsx`
- **Descripción**: Stat card de saldo.
- **Contenido**: NexaStatCard con NexaBalanceDisplay embebido

### 7.4 TimeRemainingCard

- **Ubicación**: `src/features/dashboard/components/TimeRemainingCard.tsx`
- **Descripción**: Stat card de tiempo restante.
- **Contenido**: NexaStatCard con NexaTimeDisplay embebido

### 7.5 UsageChart

- **Ubicación**: `src/features/dashboard/components/UsageChart.tsx`
- **Descripción**: Gráfico minimalista de consumo (diario/semanal/mensual).
- **Props**:
  - `data: Array<{ label: string; value: number }>`
  - `period: 'daily' | 'weekly' | 'monthly'`
  - `onPeriodChange: (period) => void`
- **Implementación**: SVG custom (no librería de charts pesada). Bar chart simple.
- **Variantes**: 
  - 7 días (semana)
  - 30 días (mes)
  - 12 meses (año)
- **Dependencias**: NexaTabs (para selector de período)

### 7.6 LastSessionsList

- **Ubicación**: `src/features/dashboard/components/LastSessionsList.tsx`
- **Descripción**: Lista de últimas sesiones.
- **Props**:
  - `sessions: SessionRecord[]`
  - `limit?: number` — default 5
  - `onViewAll?: () => void`
- **Cada item muestra**:
  - Cuenta (alias)
  - Fecha/hora inicio
  - Duración
  - Saldo consumido (si disponible)
- **Dependencias**: NexaList

---

## 8. Componentes de Feature — Scheduler

### 8.1 SchedulerPanel

- **Ubicación**: `src/features/scheduler/components/SchedulerPanel.tsx`
- **Descripción**: Vista principal del scheduler.
- **Contenido**:
  - "Nueva programación" button
  - ActiveTasksList
  - Empty state si no hay tareas

### 8.2 TimerBasedScheduler

- **Ubicación**: `src/features/scheduler/components/TimerBasedScheduler.tsx`
- **Descripción**: Form para programar logout en X minutos.
- **Props**:
  - `onCreate: (input: NewSchedulerTaskInput) => void`
  - `loading?: boolean`
- **Campos**:
  - Botones rápidos: 30/60/120 min
  - Input custom (número + unidad)
  - Switch "Notificar al desconectar"
  - Vista previa: "Cierra aprox: HH:MM"
- **Dependencias**: NexaButton, NexaInput, NexaSwitch

### 8.3 TimeBasedScheduler

- **Ubicación**: `src/features/scheduler/components/TimeBasedScheduler.tsx`
- **Descripción**: Form para programar logout a hora específica.
- **Props**: similar a TimerBasedScheduler
- **Campos**:
  - Time picker (HH:MM)
  - Repetir: una vez / diario / días específicos
  - Switch "Notificar"
- **Dependencias**: NexaInput (type=time), NexaSelect

### 8.4 ActiveTasksList

- **Ubicación**: `src/features/scheduler/components/ActiveTasksList.tsx`
- **Descripción**: Lista de tareas programadas activas.
- **Props**:
  - `tasks: SchedulerTask[]`
  - `onCancel: (taskId: SchedulerTaskId) => void`
- **Cada item**:
  - Icono según tipo (timer/time/max)
  - Descripción ("Logout en 60 min" / "Logout a las 23:00")
  - Cuenta afectada
  - Countdown (si es timer)
  - Botón cancelar (×)
- **Dependencias**: NexaList, NexaBadge

---

## 9. Componentes de Feature — Settings

### 9.1 SettingsPanel

- **Ubicación**: `src/features/settings/components/SettingsPanel.tsx`
- **Descripción**: Vista principal de settings con tabs.
- **Contenido**: NexaTabs con 5 secciones:
  - Appearance
  - Behavior
  - Notifications
  - Security
  - Backup

### 9.2 AppearanceSettings

- **Ubicación**: `src/features/settings/components/AppearanceSettings.tsx`
- **Contenido**:
  - Selección de tema (4 cards con preview)
  - Switch "Sistema" (para dark/light automático)
  - Preview en vivo

### 9.3 BehaviorSettings

- **Ubicación**: `src/features/settings/components/BehaviorSettings.tsx`
- **Contenido**:
  - Switch "Restaurar sesión al abrir"
  - Switch "Reconexión automática global" (override por cuenta)
  - Switch "Inicio automático con Chrome"
  - Select "Comportamiento al cerrar popup" (mantener sesión / logout)

### 9.4 NotificationSettings

- **Ubicación**: `src/features/settings/components/NotificationSettings.tsx`
- **Contenido**:
  - Switch "Notificaciones activadas"
  - Checkboxes por tipo de evento:
    - Desconexión
    - Reconexión exitosa
    - Saldo bajo (con input de threshold)
    - Tiempo agotándose (con input de threshold)
    - Errores del connector
  - Select "Nivel de detalle" (mínimo / normal / detallado)

### 9.5 SecuritySettings

- **Ubicación**: `src/features/settings/components/SecuritySettings.tsx`
- **Contenido**:
  - Estado de cifrado (badge "Activo")
  - Info: algoritmo, iteraciones KDF, fecha creación
  - Botón "Cambiar contraseña maestra"
  - Botón "Bloquear ahora"
  - Botón "Restablecer extensión" (danger)
- **Dependencias**: NexaBadge, NexaButton, NexaConfirmDialog

### 9.6 BackupSettings

- **Ubicación**: `src/features/settings/components/BackupSettings.tsx`
- **Contenido**:
  - Card "Exportar" con descripción de qué se incluye
  - Card "Importar" con file input
  - Info: último backup, ubicación típica
- **Dependencias**: NexaCard, NexaButton

---

## 10. Componentes de Feature — Developer

### 10.1 DeveloperPanel

- **Ubicación**: `src/features/developer/components/DeveloperPanel.tsx`
- **Descripción**: Vista principal de Developer Mode.
- **Contenido**: NexaTabs con 6 secciones:
  - Logs, Session, Connector, Network, Storage, Tools

### 10.2 LogsViewer

- **Ubicación**: `src/features/developer/components/LogsViewer.tsx`
- **Descripción**: Visor de logs con filtros.
- **Contenido**:
  - Filtros: level, category, search text, time range
  - Lista virtualizada (NexaList)
  - Cada log: timestamp, level badge, category, message, expandable details
  - Acciones: refresh, clear, export
- **Dependencias**: NexaList, NexaBadge, NexaCodeBlock

### 10.3 SessionInspector

- **Ubicación**: `src/features/developer/components/SessionInspector.tsx`
- **Descripción**: Inspector de sesión actual.
- **Contenido**:
  - Estado actual
  - Cuenta activa (con accountId, username)
  - SessionData sanitizada (sin tokens)
  - Timer info
  - Scheduler tasks activas
  - Último evento
- **Dependencias**: NexaKeyValue, NexaCodeBlock

### 10.4 ConnectorInspector

- **Ubicación**: `src/features/developer/components/ConnectorInspector.tsx`
- **Descripción**: Inspector del ETECSA connector.
- **Contenido**:
  - Current strategy
  - Last operation
  - Last success timestamp
  - Last error (con código y mensaje)
  - Consecutive failures
  - Total operations / successes / failures
  - Strategy chain visualization (5 strategies con estado)
- **Dependencias**: NexaKeyValue, NexaBadge

### 10.5 NetworkDebugPanel

- **Ubicación**: `src/features/developer/components/NetworkDebugPanel.tsx`
- **Descripción**: Visor de requests HTTP al connector.
- **Contenido**:
  - Lista de NetworkRecords (timestamp, method, url, status, duration)
  - Filtros: por status code, por URL pattern
  - Click en record expande: request headers (sanitizados), response headers, body preview
- **Dependencias**: NexaList, NexaCodeBlock

### 10.6 StorageViewer

- **Ubicación**: `src/features/developer/components/StorageViewer.tsx`
- **Descripción**: Visor de chrome.storage.local.
- **Contenido**:
  - Tree view por namespace (nexa.accounts, nexa.sessions, etc.)
  - Cada namespace expandible a sus keys
  - Click en key muestra valor (sanitizado)
  - Info: tamaño total, número de keys
- **Dependencias**: NexaCodeBlock, NexaList

### 10.7 DevTools

- **Ubicación**: `src/features/developer/components/DevTools.tsx`
- **Descripción**: Panel de herramientas de desarrollo.
- **Acciones**:
  - Test Login (con cuenta seleccionada)
  - Test Logout
  - Test Probe
  - Limpiar caché (con confirmación)
  - Limpiar logs (con confirmación)
  - Exportar logs
  - Reiniciar extensión
  - Full diagnostic
- **Cada acción muestra**: confirmación → ejecución → resultado detallado (timing, response)

---

## 11. Componentes de Feature — Onboarding

### 11.1 OnboardingFlow

- **Ubicación**: `src/features/onboarding/components/OnboardingFlow.tsx`
- **Descripción**: Wizard de onboarding multi-paso.
- **Props**:
  - `onComplete: () => void`
- **Pasos**:
  1. Welcome (con NexaLogo xl)
  2. Por qué cifrado
  3. Crear master password (con strength meter)
  4. ¡Listo! + CTA agregar cuenta
- **Estado**: paso actual, loading, error
- **Dependencias**: NexaLogo, NexaPasswordInput, NexaButton

### 11.2 CreateMasterPassword

- **Ubicación**: `src/features/onboarding/components/CreateMasterPassword.tsx`
- **Descripción**: Form para crear master password.
- **Props**:
  - `onSubmit: (password: string) => void`
  - `loading?: boolean`
- **Campos**:
  - Password (con strength meter visual)
  - Confirm password
  - Checkbox "Entiendo que no hay recuperación"
- **Strength meter**: bar con 4 segmentos (weak/medium/strong/very-strong) + label

### 11.3 ConfirmMasterPassword

- **Ubicación**: `src/features/onboarding/components/ConfirmMasterPassword.tsx`
- **Descripción**: Re-input de password para confirmar.

---

## 12. Componentes de Feature — Unlock

### 12.1 UnlockScreen

- **Ubicación**: `src/features/unlock/components/UnlockScreen.tsx`
- **Descripción**: Pantalla de unlock.
- **Props**:
  - `onUnlock: (password: string) => void`
  - `onReset: () => void`
  - `loading?: boolean`
  - `error?: NexaError`
  - `cooldownUntil?: number` — timestamp hasta el cual está bloqueado
- **Contenido**:
  - NexaLogo
  - Title "NEXA NautaX bloqueado"
  - Description
  - NexaPasswordInput
  - NexaButton "Desbloquear"
  - Link "¿Olvidaste tu contraseña?"
- **Estados**: idle, loading, error, cooldown (con countdown)

---

## 13. Componentes auxiliares (no visuales)

### 13.1 ErrorBoundary

- **Ubicación**: `src/components/ErrorBoundary.tsx`
- **Descripción**: React error boundary global.
- **Comportamiento**: captura errores de render, muestra pantalla de error amigable.
- **Contenido**:
  - Icono error
  - "Algo salió mal"
  - Mensaje sanitizado del error
  - Botón "Recargar"
- **Dependencias**: ninguna

### 13.2 AsyncBoundary

- **Ubicación**: `src/components/AsyncBoundary.tsx`
- **Descripción**: Wrapper para componentes que cargan async data.
- **Props**:
  - `loading: boolean`
  - `error?: NexaError`
  - `empty?: boolean`
  - `emptyState?: ReactNode`
  - `children: ReactNode`
- **Comportamiento**:
  - loading → Skeleton
  - error → ErrorCard con retry
  - empty → emptyState o default
  - else → children

---

## 14. Resumen — Conteo total

| Categoría | Componentes |
|-----------|-------------|
| NEXA branded | 23 |
| shadcn/ui base | 15 (a generar bajo demanda) |
| Layout | 5 |
| Auth | 4 |
| Accounts | 5 |
| Dashboard | 6 |
| Scheduler | 4 |
| Settings | 6 |
| Developer | 7 |
| Onboarding | 3 |
| Unlock | 1 |
| Auxiliares | 2 |
| **Total** | **81 componentes** |

---

## 15. Prioridades de implementación

### Fase 5 (Núcleo) — imprescindibles

- NexaLogo
- NexaButton
- NexaCard
- NexaStatusIndicator
- NexaSpinner
- NexaBanner
- NexaInput, NexaPasswordInput
- PopupLayout, SidePanelLayout, SidePanelNav
- ErrorBoundary
- Skeleton (shadcn)
- Switch (shadcn) → NexaSwitch

### Fase 7 (UI completa) — el resto

- NexaToast + NexaToastContainer
- NexaConfirmDialog
- NexaEmptyState
- NexaSelect, NexaBadge, NexaTabs
- NexaStatCard, NexaTimeDisplay, NexaBalanceDisplay
- NexaIcon, NexaCodeBlock, NexaKeyValue, NexaList
- Todos los feature components

---

## 16. Pendientes para Fases siguientes

### Fase 5
- Setup shadcn/ui CLI.
- Generar componentes base en orden de prioridad.
- Configurar Tailwind con CSS variables de NEXA.

### Fase 7
- Implementar feature components consumiendo los design tokens y componentes NEXA.
- Tests visuales de cada componente (Storybook opcional).

---

**Fin del Documento 3.**
Continúa en `04-screen-specifications.md`.
