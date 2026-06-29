# NEXA NautaX — Screen Specifications

**Fase:** 3
**Documento:** 4 de 4
**Autor:** Arquitecto NEXA NautaX + Designer UI
**Fecha:** 2026-06-22

> Especificación detallada de cada pantalla: layout, contenido, estados, transiciones. **No es wireframe visual** — es contrato de implementación.

---

## 1. Convences

### 1.1 Estructura de cada screen

```
### ScreenName
- **Ubicación**: ruta del componente
- **Surface**: popup | sidepanel | offscreen
- **Dimensiones**: tamaño o comportamiento responsive
- **Estados**: lista de estados posibles
- **Layout**: descripción con ASCII art
- **Contenido**: elementos por zona
- **Interacciones**: acciones del usuario
- **Estados visuales**: qué cambia según estado
```

---

## 2. POPUP — Pantallas

### 2.1 PopupLayout (esqueleto)

- **Surface**: popup
- **Dimensiones**: 380×520 px fijos
- **Estructura**:

```
┌─────────────────────────────────────┐ 380px
│ [NEXA NautaX]            [🌙/☀️]    │  Header — 48px
├─────────────────────────────────────┤
│                                     │
│                                     │
│           Content                   │  flex-1
│           (cambia por estado)       │  padding: 16px
│                                     │
│                                     │
├─────────────────────────────────────┤
│ ● Conectado · pepe@nauta...  [⋯]   │  Footer — 40px
└─────────────────────────────────────┘
                                       520px total
```

### 2.2 Popup — Onboarding

- **Estado**: `crypto.isInitialized() === false`
- **Layout**:

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│                                     │
│         [NEXA logo xl]              │
│                                     │
│         NEXA NautaX                 │  Syne SemiBold 32px
│                                     │
│   Administra tus cuentas Nauta      │  DNSans Regular 14px, muted
│   con elegancia y seguridad.        │
│                                     │
│                                     │
│         [Comenzar →]                │  NexaButton primary, fullWidth
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Versión 1.0.0                       │
└─────────────────────────────────────┘
```

### 2.3 Popup — Onboarding Step 2: Cifrado

```
┌─────────────────────────────────────┐
│ ← Onboarding           [🌙/☀️]      │
├─────────────────────────────────────┤
│                                     │
│         [🛡 Shield icon 32px]        │
│                                     │
│      Cifrado local AES-256          │  Syne 20px
│                                     │
│   Tus credenciales se cifran        │
│   localmente con AES-256.           │
│   Nosotros no podemos verlas.       │
│                                     │
│   Crea una contraseña maestra       │
│   para protegerlas.                 │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ⚠ Si la olvidas, no podrás  │   │  NexaBanner warning
│   │ recuperar tus cuentas.      │   │
│   └─────────────────────────────┘   │
│                                     │
│         [Entendido →]               │
│                                     │
├─────────────────────────────────────┤
│ Paso 2 de 4 ●●○○                    │  Progress dots
└─────────────────────────────────────┘
```

### 2.4 Popup — Onboarding Step 3: Crear Master Password

```
┌─────────────────────────────────────┐
│ ← Onboarding           [🌙/☀️]      │
├─────────────────────────────────────┤
│                                     │
│   Crea tu contraseña maestra        │  Syne 20px
│                                     │
│   Contraseña                        │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │  NexaPasswordInput
│   └─────────────────────────────┘   │
│   Fortaleza: ●●●○○ Media            │  Strength meter
│                                     │
│   Confirmar contraseña              │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│                                     │
│   ☑ Entiendo que si olvido la      │  NexaSwitch
│     contraseña perderé mis cuentas │
│                                     │
│   [Cancelar]    [Crear →]          │
│                                     │
├─────────────────────────────────────┤
│ Paso 3 de 4 ●●●○                    │
└─────────────────────────────────────┘
```

### 2.5 Popup — Onboarding Step 4: ¡Listo!

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│        [✓ CheckCircle 48px]         │  success color
│                                     │
│        ¡Cifrado activado!           │  Syne 24px
│                                     │
│   Ahora agrega tu primera cuenta    │
│   Nauta para comenzar.              │  DNSans 14px, muted
│                                     │
│   [+ Agregar cuenta]                │  NexaButton primary
│                                     │
│   [Omitir por ahora]                │  NexaButton ghost
│                                     │
├─────────────────────────────────────┤
│ Paso 4 de 4 ●●●●                    │
└─────────────────────────────────────┘
```

### 2.6 Popup — Unlock Screen

- **Estado**: `crypto.isLocked() === true`
- **Layout**:

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│         [🔒 Lock icon 32px]          │
│                                     │
│         NEXA NautaX                 │  Syne 24px
│         bloqueado                   │
│                                     │
│   Ingresa tu contraseña maestra     │  DNSans 14px, muted
│   para continuar.                   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │  NexaPasswordInput
│   └─────────────────────────────┘   │
│                                     │
│   [Desbloquear]                     │  NexaButton primary, fullWidth
│                                     │
│   ¿Olvidaste tu contraseña?         │  Link, sm, subtle
│   Restablecer extensión             │
│                                     │
├─────────────────────────────────────┤
│ Última sesión: hace 2 horas         │  Hint info
└─────────────────────────────────────┘
```

**Estado cooldown (3 intentos fallidos)**:

```
   ┌─────────────────────────────┐   
   │ ●●●●●●●●●●●●            [👁]│   ← disabled
   └─────────────────────────────┘   
                                     
   ⏱ Demasiados intentos.           
   Espera 28s para reintentar.       ← countdown
   
   [Desbloquear]                      ← disabled
```

### 2.7 Popup — Logged Out (sin sesión)

- **Estado**: `sessionManager.getActiveSession() === null` y `connectionState ∈ ['CAPTIVE_PORTAL', 'SESSION_EXPIRED']`
- **Layout**:

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ● Desconectado                    │  NexaStatusIndicator
│                                     │
│   Cuenta                            │
│   ┌─────────────────────────────┐   │
│   │ pepe@nauta.com.cu         ▼ │   │  NexaSelect (si >1 cuenta)
│   └─────────────────────────────┘   │
│                                     │
│   Contraseña                        │  ← si "recordar" desactivado
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│                                     │
│   ☑ Recordar contraseña            │  NexaSwitch sm
│                                     │
│   [Conectar]                        │  NexaButton primary, fullWidth
│                                     │
│   ¿No tienes cuenta? [+ Agregar]   │  Link, sm
│                                     │
├─────────────────────────────────────┤
│ ● Desconectado · Sin sesión  [⋯]   │
└─────────────────────────────────────┘
```

### 2.8 Popup — Connecting

- **Estado**: login en progreso

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ● Conectando...                   │  StatusIndicator pulse
│                                     │
│   [Spinner grande]                  │
│                                     │
│   Conectando con ETECSA...          │  Syne 18px
│                                     │
│   pepe@nauta.com.cu                 │  muted
│                                     │
│   Esto puede tardar unos segundos.  │  subtle, sm
│                                     │
│   [Cancelar]                        │  NexaButton ghost
│                                     │
├─────────────────────────────────────┤
│ ● Conectando · Intento 1  [⋯]      │
└─────────────────────────────────────┘
```

### 2.9 Popup — Connected (logged in)

- **Estado**: sesión activa

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ● Conectado                       │  StatusIndicator success
│                                     │
│   ┌─────────────┐ ┌─────────────┐   │
│   │ Tiempo       │ │ Saldo        │   │  NexaStatCard x2
│   │ conectado    │ │              │   │
│   │ 01:23:45     │ │ $25.50 CUP   │   │  NexaTimeDisplay + BalanceDisplay
│   └─────────────┘ └─────────────┘   │
│                                     │
│   Cuenta activa                     │
│   pepe@nauta.com.cu                 │  mono, sm
│                                     │
│   ┌─────────────────────────────┐   │
│   │ [Abrir dashboard →]         │   │  NexaButton secondary, fullWidth
│   └─────────────────────────────┘   │
│                                     │
│   [Desconectar]                     │  NexaButton danger, fullWidth
│                                     │
├─────────────────────────────────────┤
│ ● Conectado · pepe@nauta...  [⋯]   │
└─────────────────────────────────────┘
```

### 2.10 Popup — Offline

- **Estado**: `connectionState === 'OFFLINE'`

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ⚠ Sin conexión con ETECSA   │   │  NexaBanner warning
│   │ Operaciones de ETECSA no    │   │
│   │ disponibles.                │   │
│   └─────────────────────────────┘   │
│                                     │
│   Puedes seguir gestionando         │
│   tus cuentas localmente.           │
│                                     │
│   Cuenta                            │
│   ┌─────────────────────────────┐   │
│   │ pepe@nauta.com.cu         ▼ │   │  ← habilitado (CRUD local)
│   └─────────────────────────────┘   │
│                                     │
│   [Conectar]                        │  ← disabled con tooltip
│                                     │
│   [+ Agregar cuenta]                │  ← habilitado
│                                     │
├─────────────────────────────────────┤
│ ○ Sin conexión · Esperando  [⋯]    │
└─────────────────────────────────────┘
```

### 2.11 Popup — Error de Login

- **Estado**: login fallido

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ⚠ Credenciales incorrectas  │   │  NexaBanner error
│   │ Verifica tu usuario y       │   │
│   │ contraseña.                 │   │
│   └─────────────────────────────┘   │
│                                     │
│   Cuenta                            │
│   ┌─────────────────────────────┐   │
│   │ pepe@nauta.com.cu         ▼ │   │
│   └─────────────────────────────┘   │
│                                     │
│   Contraseña                        │
│   ┌─────────────────────────────┐   │  ← vacío, focus, shake animation
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│                                     │
│   [Conectar]                        │
│                                     │
├─────────────────────────────────────┤
│ ✕ Error · Reintentar       [⋯]     │
└─────────────────────────────────────┘
```

### 2.12 Popup — Reconnecting

- **Estado**: auto-reconnect en progreso

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ● Reconectando...                 │  StatusIndicator warning pulse
│                                     │
│   [Spinner grande]                  │
│                                     │
│   Intento 2 de 3                    │  Syne 18px
│   Próximo intento en 45s            │  muted
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ████████░░░░░░░░░░░░        │   │  Countdown progress bar
│   └─────────────────────────────┘   │
│                                     │
│   [Cancelar]                        │
│                                     │
├─────────────────────────────────────┤
│ ● Reconectando · Intento 2/3  [⋯]  │
└─────────────────────────────────────┘
```

### 2.13 Popup — Session Expired

- **Estado**: `connectionState === 'SESSION_EXPIRED'`

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ⚠ Sesión expirada           │   │  NexaBanner warning
│   │ ETECSA cerró la sesión.     │   │
│   └─────────────────────────────┘   │
│                                     │
│   Última sesión:                    │
│   pepe@nauta.com.cu                 │
│   Duración: 01:23:45                │  mono
│                                     │
│   [Reconectar]                      │  NexaButton primary
│                                     │
│   [Cerrar]                          │  NexaButton ghost
│                                     │
├─────────────────────────────────────┤
│ ○ Sesión expirada · Listo  [⋯]     │
└─────────────────────────────────────┘
```

### 2.14 Popup — Footer Status Bar

Comportamiento del footer según estado:

| Estado | Indicador | Texto | Acciones |
|--------|-----------|-------|----------|
| Conectado | ● verde | `pepe@nauta...` | [⋯] menu (logout, dashboard) |
| Desconectado | ● gris | `Sin sesión` | [⋯] menu (login, accounts) |
| Conectando | ● amarillo pulse | `Intento 1` | [⋯] menu (cancel) |
| Reconectando | ● amarillo pulse | `Intento 2/3` | [⋯] menu (cancel) |
| Offline | ○ sutil | `Esperando` | [⋯] menu (accounts, settings) |
| Sesión expirada | ● amarillo | `Reintentar` | [⋯] menu (reconnect) |
| Error | ✕ rojo | `Reintentar` | [⋯] menu (retry) |

Menú [⋯] dropdown:
- Conectado: Dashboard, Cuentas, Settings, Developer, Desconectar
- Desconectado: Cuentas, Settings, Developer
- Otros: según estado

---

## 3. SIDEPANEL — Pantallas

### 3.1 SidePanelLayout (esqueleto)

- **Surface**: sidepanel
- **Dimensiones**: ancho variable (Chrome controla, ~320-500px), altura full viewport

```
┌──────────────────────────────────────────────────────┐
│ [NEXA NautaX]              [🌙/☀️]  ● Conectado    │  Header — 56px
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│ 📊   │                                               │
│ Dash │                                               │
│      │                                               │
│ 👥   │              Content                          │  flex-1
│ Cntas│              (cambia por view)                │  padding: 24px
│      │                                               │
│ 📅   │                                               │
│ Sched│                                               │
│      │                                               │
│ ⚙️   │                                               │
│ Sett │                                               │
│      │                                               │
│ 🖥   │                                               │
│ Dev  │                                               │
│      │                                               │
├──────┴───────────────────────────────────────────────┤
│ ● Conectado · pepe@nauta... · v1.0.0                │  Footer — 40px
└──────────────────────────────────────────────────────┘
   64px
```

### 3.2 SidePanel — Dashboard

```
┌──────────────────────────────────────────────────────┐
│ [NEXA NautaX]              [🌙/☀️]  ● Conectado    │
├──────┬───────────────────────────────────────────────┤
│      │ Dashboard                                     │  Syne 24px
│ 📊 ◄ │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│ 👥   │ │ ● Conectado                             │   │  ActiveSessionCard
│      │ │                                          │   │
│ 📅   │ │ pepe@nauta.com.cu                       │   │
│      │ │ Cuenta personal                         │   │
│ ⚙️   │ │                                          │   │
│      │ │ ┌──────────┐ ┌──────────┐               │   │
│ 🖥   │ │ │ Tiempo    │ │ Saldo     │               │   │
│      │ │ │ 01:23:45  │ │ $25.50    │               │   │
│      │ │ │ conectado │ │ CUP       │               │   │
│      │ │ └──────────┘ └──────────┘               │   │
│      │ │                                          │   │
│      │ │ Inicio: 13:08 · Hace 1h 23min           │   │
│      │ │                                          │   │
│      │ │ [Refrescar]  [Desconectar]              │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Consumo                                       │  Syne 18px
│      │ [Diario] [Semanal] [Mensual]                  │  NexaTabs
│      │ ┌─────────────────────────────────────────┐   │
│      │ │                                          │   │  UsageChart
│      │ │  ▌   ▌▌  ▌▌▌                            │   │  bar chart
│      │ │ ▌▌ ▌▌▌▌▌▌▌▌▌▌                           │   │
│      │ │ ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                         │   │
│      │ │  L  M  M  J  V  S  D                    │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Últimas sesiones                              │  Syne 18px
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ pepe@nauta.com.cu                       │   │
│      │ │ Hoy 13:08 - 14:32 · 1h 24min · $4.20   │   │
│      │ ├─────────────────────────────────────────┤   │
│      │ │ maria@nauta.com.cu                      │   │
│      │ │ Ayer 18:00 - 19:30 · 1h 30min · $4.50  │   │
│      │ ├─────────────────────────────────────────┤   │
│      │ │ pepe@nauta.com.cu                       │   │
│      │ │ Ayer 10:00 - 12:15 · 2h 15min · $6.75  │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ [Ver todo el historial →]                    │
│      │                                               │
├──────┴───────────────────────────────────────────────┤
│ ● Conectado · pepe@nauta... · v1.0.0                │
└──────────────────────────────────────────────────────┘
```

### 3.3 SidePanel — Dashboard vacío (sin sesión)

```
│      │ Dashboard                                     │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │                                          │   │
│      │ │        [📊 icon 48px]                    │   │  NexaEmptyState
│      │ │                                          │   │
│      │ │    No hay sesión activa                  │   │  Syne 20px
│      │ │                                          │   │
│      │ │ Conecta una cuenta para ver el estado    │   │  muted
│      │ │ en tiempo real.                          │   │
│      │ │                                          │   │
│      │ │       [Conectar cuenta]                  │   │  NexaButton primary
│      │ │                                          │   │
│      │ └─────────────────────────────────────────┘   │
```

### 3.4 SidePanel — Accounts

```
│      │ Cuentas                                       │  Syne 24px
│ 👥 ◄ │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ [+ Agregar cuenta]                      │   │  NexaButton primary
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Cuentas guardadas (3)                         │  Syne 18px
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ● Activa    [Prepago]                   │   │  AccountCard
│      │ │                                          │   │
│      │ │ Cuenta personal                          │   │  Syne 16px
│      │ │ pepe@nauta.com.cu                       │   │  mono sm
│      │ │ Último uso: hace 5 minutos              │   │  subtle xs
│      │ │                              [⋯]        │   │  dropdown: editar/eliminar
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ○ Inactiva  [Prepago]                   │   │
│      │ │                                          │   │
│      │ │ Trabajo                                  │   │
│      │ │ maria@nauta.com.cu                      │   │
│      │ │ Último uso: ayer                        │   │
│      │ │                              [⋯]        │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ○ Inactiva  [Prepago]                   │   │
│      │ │                                          │   │
│      │ │ Secundaria                               │   │
│      │ │ jose@nauta.com.cu                       │   │
│      │ │ Último uso: hace 3 días                 │   │
│      │ │                              [⋯]        │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
```

### 3.5 SidePanel — Accounts vacío

```
│      │ Cuentas                                       │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │                                          │   │
│      │ │        [👤 icon 48px]                    │   │
│      │ │                                          │   │
│      │ │    No hay cuentas todavía                │   │
│      │ │                                          │   │
│      │ │ Agrega tu primera cuenta Nauta para      │   │
│      │ │ comenzar a usar NEXA NautaX.             │   │
│      │ │                                          │   │
│      │ │       [+ Agregar cuenta]                 │   │
│      │ │                                          │   │
│      │ └─────────────────────────────────────────┘   │
```

### 3.6 SidePanel — Account Form Dialog

Modal overlay:

```
┌──────────────────────────────────────────────────────┐
│ (overlay oscuro semi-transparente con blur)          │
│                                                      │
│    ┌──────────────────────────────────────────┐      │
│    │ ← Nueva cuenta                       [×] │      │  Header
│    ├──────────────────────────────────────────┤      │
│    │                                          │      │
│    │  Alias                                   │      │
│    │  ┌──────────────────────────────────┐    │      │
│    │  │ Cuenta personal                  │    │      │
│    │  └──────────────────────────────────┘    │      │
│    │                                          │      │
│    │  Usuario                                 │      │
│    │  ┌──────────────────────────────────┐    │      │
│    │  │ pepe@nauta.com.cu                │    │      │
│    │  └──────────────────────────────────┘    │      │
│    │  Sugerencia: se autocompleta con        │      │  hint
│    │  @nauta.com.cu si no incluyes @          │      │
│    │                                          │      │
│    │  Contraseña                              │      │
│    │  ┌──────────────────────────────────┐    │      │
│    │  │ ●●●●●●●●●●●●●●●●            [👁] │    │      │
│    │  └──────────────────────────────────┘    │      │
│    │                                          │      │
│    │  Tipo                                    │      │
│    │  (●) Prepago                             │      │
│    │                                          │      │
│    │  ─── Política de reconexión ───          │      │
│    │                                          │      │
│    │  ☑ Reconectar automáticamente           │      │
│    │                                          │      │
│    │    Reintentos máximos: [3 ▼]            │      │
│    │    Strategy: [Exponencial ▼]            │      │
│    │                                          │      │
│    │    Si saldo agotado:                    │      │
│    │    (●) Detener                           │      │
│    │    ( ) Cambiar a otra cuenta            │      │
│    │                                          │      │
│    │  ☐ Verificar credenciales ahora         │      │
│    │  (conecta a ETECSA para validar)        │      │
│    │                                          │      │
│    ├──────────────────────────────────────────┤      │
│    │      [Cancelar]    [Guardar]             │      │  Footer
│    └──────────────────────────────────────────┘      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.7 SidePanel — Scheduler

```
│      │ Programación                                  │  Syne 24px
│ 📅 ◄ │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ [+ Nueva programación]                  │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Tareas activas (2)                            │  Syne 18px
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ⏱  Desconectar en 60 min                │   │  AccountCard-like
│      │ │                                          │   │
│      │ │ Cuenta: pepe@nauta.com.cu               │   │
│      │ │ Cierra aprox: 14:32                     │   │  mono
│      │ │                                          │   │
│      │ │ Countdown: 45:23                        │   │  large mono
│      │ │                              [×]        │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ⏰  Desconectar a las 23:00              │   │
│      │ │                                          │   │
│      │ │ Cuenta: maria@nauta.com.cu              │   │
│      │ │ Próxima ejecución: hoy 23:00            │   │
│      │ │                              [×]        │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Historial de ejecuciones                      │  Syne 18px
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ✓ 2026-06-22 13:00  Logout completado   │   │
│      │ │ ✓ 2026-06-21 23:00  Logout completado   │   │
│      │ │ ✗ 2026-06-20 23:00  Fallo: sin sesión   │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
```

### 3.8 SidePanel — Scheduler vacío

```
│      │ Programación                                  │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │                                          │   │
│      │ │        [⏰ icon 48px]                    │   │
│      │ │                                          │   │
│      │ │    Sin programaciones                    │   │
│      │ │                                          │   │
│      │ │ Programa desconexiones automáticas       │   │
│      │ │ para no consumir saldo innecesariamente.│   │
│      │ │                                          │   │
│      │ │       [+ Nueva programación]            │   │
│      │ │                                          │   │
│      │ └─────────────────────────────────────────┘   │
```

### 3.9 SidePanel — Settings

```
│      │ Configuración                                 │  Syne 24px
│ ⚙️ ◄ │                                               │
│      │ [Apariencia] [Comportamiento]                 │  NexaTabs
│      │ [Notificaciones] [Seguridad] [Backup]         │
│      │                                               │
│      │ ─── Apariencia ───                            │
│      │                                               │
│      │ Tema                                           │
│      │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│      │ │     │ │     │ │     │ │     │               │  Cards con preview
│      │ │Dark │ │Light│ │Nebul│ │Auror│               │
│      │ │  ✓  │ │     │ │     │ │     │               │  Border primary en activo
│      │ └─────┘ └─────┘ └─────┘ └─────┘               │
│      │                                               │
│      │ ☐ Sistema (solo Dark/Light)                  │
│      │                                               │
│      │ Vista previa                                  │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ┌─────────────────────┐                 │   │  Mini preview
│      │ │ │ Card de ejemplo      │  [Botón primary]│   │
│      │ │ │ ● Conectado          │                │   │
│      │ │ └─────────────────────┘                 │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ─── Tipografía ───                            │
│      │                                               │
│      │ Syne: títulos y branding                      │  preview
│      │ DNSans: interfaz general                      │
│      │ JetBrainsMono: Developer Mode                 │
│      │                                               │
```

### 3.10 SidePanel — Settings: Security

```
│      │ Configuración                                 │
│      │ [Apariencia] ... [Seguridad ✓] [Backup]       │
│      │                                               │
│      │ ─── Cifrado ───                               │
│      │                                               │
│      │ Estado                                        │
│      │ ● Activo   [AES-256-GCM]                     │  Badge success
│      │                                               │
│      │ Algoritmo: AES-256-GCM                        │  NexaKeyValue
│      │ KDF: PBKDF2-SHA256                            │
│      │ Iteraciones: 250,000                          │
│      │ Creado: 2026-06-15                            │
│      │                                               │
│      │ ─── Acciones ───                              │
│      │                                               │
│      │ [Cambiar contraseña maestra]                  │  NexaButton secondary
│      │                                               │
│      │ [Bloquear ahora]                              │  NexaButton secondary
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ⚠ Zona de peligro                       │   │  NexaBanner error variant
│      │ │                                          │   │
│      │ │ Restablecer extensión elimina TODOS    │   │
│      │ │ tus datos (cuentas, historial, settings,│   │
│      │ │ logs). No se puede deshacer.            │   │
│      │ │                                          │   │
│      │ │ [Restablecer extensión]                 │   │  NexaButton danger
│      │ └─────────────────────────────────────────┘   │
```

### 3.11 SidePanel — Settings: Backup

```
│      │ Configuración                                 │
│      │ ... [Backup ✓]                                │
│      │                                               │
│      │ ─── Exportar ───                              │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ 📦 Backup completo                       │   │  NexaCard
│      │ │                                          │   │
│      │ │ Incluye:                                 │   │
│      │ │  ✓ Cuentas (credenciales cifradas)      │   │
│      │ │  ✓ Configuraciones                       │   │
│      │ │  ✓ Historial                             │   │
│      │ │  ✓ Programaciones                        │   │
│      │ │                                          │   │
│      │ │ NO incluye:                              │   │
│      │ │  ✗ Logs (exportar por separado)         │   │
│      │ │  ✗ Llaves de cifrado                    │   │
│      │ │                                          │   │
│      │ │ Último backup: hace 5 días              │   │  subtle
│      │ │                                          │   │
│      │ │ [Exportar todo]                          │   │  NexaButton primary
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ─── Importar ───                              │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ 📥 Importar backup                       │   │
│      │ │                                          │   │
│      │ │ Selecciona un archivo .json de backup   │   │
│      │ │                                          │   │
│      │ │ [Seleccionar archivo]                   │   │  file input
│      │ │ o arrastrá y soltá aquí                 │   │
│      │ │                                          │   │
│      │ │ ⚠ Esto reemplazará todos tus datos      │   │  NexaBanner warning
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
```

### 3.12 SidePanel — Developer Mode: Logs

```
│      │ Developer Mode                                │  Syne 24px
│ 🖥 ◄ │                                               │
│      │ [Logs ✓] [Session] [Connector]                │  NexaTabs
│      │ [Network] [Storage] [Tools]                   │
│      │                                               │
│      │ Filtros                                       │
│      │ Level: [All ▼] Category: [All ▼] [🔍...]     │
│      │ [Refrescar] [Limpiar] [Exportar]              │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ 14:32:15  INFO   session    Login...    │   │  JetBrainsMono
│      │ │ 14:32:17  DEBUG  connector  Probe...    │   │  sm, monospace
│      │ │ 14:32:18  DEBUG  connector  POST Login  │   │
│      │ │ 14:32:20  INFO   session    Login OK    │   │
│      │ │ 14:32:35  DEBUG  scheduler  Heartbeat   │   │
│      │ │ 14:33:15  DEBUG  connection Probe A:204 │   │
│      │ │ ...                                     │   │
│      │ │ (scroll virtualizado)                   │   │
│      │ │                                          │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Mostrando 6 de 4,521 logs                     │  subtle xs
│      │                                               │
```

### 3.13 SidePanel — Developer Mode: Connector Inspector

```
│      │ Developer Mode                                │
│      │ [Logs] [Session] [Connector ✓] ...            │
│      │                                               │
│      │ ─── Estado actual ───                         │
│      │                                               │
│      │ Estrategia actual: KnownEndpoint             │  NexaKeyValue
│      │ Última operación: login                       │
│      │ Último éxito: hace 5 min                      │
│      │ Último error: —                               │
│      │ Fallos consecutivos: 0                        │
│      │                                               │
│      │ ─── Estadísticas ───                          │
│      │                                               │
│      │ Total operaciones: 47                         │
│      │ Éxitos: 45                                    │
│      │ Fallos: 2                                     │
│      │ Tasa de éxito: 95.7%                          │
│      │                                               │
│      │ ─── Strategy Chain ───                        │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ✓ KnownEndpoint      45 éxitos / 0 fallos│   │  verde
│      │ │ ○ DiscoveredEndpoint  (no usada)         │   │  gris
│      │ │ ○ ScrapingDom        (no usada)          │   │
│      │ │ ○ ScrapingRegex      (no usada)          │   │
│      │ │ ○ ManualFallback     (no usada)          │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ ─── Último error ───                          │
│      │                                               │
│      │ (vacío — sin errores recientes)               │
│      │                                               │
```

### 3.14 SidePanel — Developer Mode: Network Debug

```
│      │ Developer Mode                                │
│      │ ... [Network ✓] ...                           │
│      │                                               │
│      │ Filtros                                       │
│      │ Status: [All ▼] URL: [🔍...]                  │
│      │ [Limpiar historial]                           │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ 14:32:17 POST  secure.etecsa.net:8443/  │   │
│      │ │          200   1.2s   strategy: Known   │   │
│      │ ├─────────────────────────────────────────┤   │
│      │ │ 14:32:18 POST  //LoginServlet           │   │
│      │ │          200   850ms strategy: Known    │   │
│      │ ├─────────────────────────────────────────┤   │
│      │ │ 14:32:20 POST  EtecsaQueryServlet       │   │
│      │ │          200   420ms strategy: Known    │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
│      │ Click en un registro para expandir:           │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ ▼ 14:32:18 POST //LoginServlet          │   │  expandido
│      │ │                                          │   │
│      │ │ Request:                                 │   │
│      │ │   Method: POST                           │   │
│      │ │   URL: https://secure.etecsa.net:8443/  │   │
│      │ │       //LoginServlet                     │   │
│      │ │   Headers:                               │   │
│      │ │     Content-Type: application/x-www-... │   │
│      │ │     Cookie: JSESSIONID=***              │   │  sanitizado
│      │ │   Body:                                  │   │
│      │ │     username=***@***                     │   │  sanitizado
│      │ │     password=***                         │   │
│      │ │     CSRFHW=***                           │   │
│      │ │     ...                                  │   │
│      │ │                                          │   │
│      │ │ Response:                                │   │
│      │ │   Status: 200                            │   │
│      │ │   Duration: 850ms                        │   │
│      │ │   Strategy: KnownEndpoint                │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
```

### 3.15 SidePanel — Developer Mode: Storage Viewer

```
│      │ Developer Mode                                │
│      │ ... [Storage ✓] [Tools]                       │
│      │                                               │
│      │ Espacio usado: 234 KB / 10 MB                │  progress bar
│      │                                               │
│      │ ─── Namespaces ───                            │
│      │                                               │
│      │ ▼ nexa.accounts (3)                          │
│      │   ▼ acc_001                                   │
│      │     alias: "Cuenta personal"                 │
│      │     username: "pepe@nauta.com.cu"            │
│      │     encryptedPassword: "AES:***"             │  sanitizado
│      │     type: "prepaid"                          │
│      │     ...                                      │
│      │   ▶ acc_002                                   │
│      │   ▶ acc_003                                   │
│      │                                               │
│      │ ▶ nexa.sessions (1)                          │
│      │ ▶ nexa.history (45)                          │
│      │ ▶ nexa.settings (1)                          │
│      │ ▶ nexa.scheduler (2)                         │
│      │ ▶ nexa.logs (4521)                           │
│      │ ▶ nexa.notifications (0)                     │
│      │ ▶ nexa.meta (1)                              │
│      │                                               │
```

### 3.16 SidePanel — Developer Mode: Tools

```
│      │ Developer Mode                                │
│      │ ... [Tools ✓]                                 │
│      │                                               │
│      │ ─── Connector ───                             │
│      │                                               │
│      │ [Test Login]   [Test Logout]                  │  NexaButtons
│      │ [Test Probe]                                 │
│      │                                               │
│      │ ─── Storage ───                               │
│      │                                               │
│      │ [Limpiar caché]                              │
│      │                                               │
│      │ ─── Logs ───                                  │
│      │                                               │
│      │ [Exportar logs]   [Limpiar logs]              │
│      │                                               │
│      │ ─── Estado ───                                │
│      │                                               │
│      │ [Reiniciar extensión]                        │  NexaButton danger
│      │                                               │
│      │ ─── Diagnóstico ───                           │
│      │                                               │
│      │ [Ejecutar full diagnostic]                   │
│      │                                               │
│      │ ─── Última ejecución ───                      │
│      │                                               │
│      │ ┌─────────────────────────────────────────┐   │
│      │ │ Test Login — hace 2 min                 │   │
│      │ │ ✓ Éxito en 1.2s                         │   │
│      │ │ Strategy: KnownEndpoint                 │   │
│      │ │ Timing: DNS 23ms / TCP 45ms / TLS 120ms │   │
│      │ │         TTFB 850ms / Total 1.2s         │   │
│      │ └─────────────────────────────────────────┘   │
│      │                                               │
```

---

## 4. Offscreen Document

### 4.1 Offscreen — Estructura

- **Surface**: offscreen
- **Visible**: NO (es documento oculto)
- **Propósito**: parsing HTML con DOMParser

**Estructura HTML mínima**:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NEXA NautaX Offscreen</title>
</head>
<body>
  <script src="offscreen.ts"></script>
</body>
</html>
```

**Script**:

```typescript
// Conceptual
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'OFFSCREEN_PARSE') return;

  const request = message.payload;
  const parser = new DOMParser();

  switch (request.type) {
    case 'PARSE_LOGIN_FORM':
      // parsear HTML, extraer CSRFHW, wlanuserip, etc.
      const doc = parser.parseFromString(request.html, 'text/html');
      const form = doc.querySelector('#formulario');
      // ... extraer campos
      sendResponse({ ok: true, data: { /* ... */ } });
      break;
    // ... otros casos
  }

  return true;  // async response
});
```

No hay UI visible — solo lógica de parsing.

---

## 5. Estados globales que afectan todas las screens

### 5.1 Toast Container

En cada surface (popup y sidepanel), el NexaToastContainer está fijado en top-right:

```
┌─────────────────────────────────────┐
│                          ┌─────────┐│  ← toast aquí
│                          │ ✓ Éxito ││
│                          └─────────┘│
│                                     │
│  (resto de la UI normal)            │
│                                     │
```

Máximo 3 visibles simultáneamente, stack vertical.

### 5.2 Banner Offline

Si `connectionState === 'OFFLINE'`, banner aparece en la parte superior del content:

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │  ← banner
│ │ ⚠ Sin conexión con ETECSA       │ │
│ │ Operaciones de ETECSA no        │ │
│ │ disponibles.                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│  (resto de la UI, con botones      │
│   ETECSA deshabilitados)            │
│                                     │
```

### 5.3 Loading overlay

Para operaciones críticas (login, logout, master password setup):

```
┌─────────────────────────────────────┐
│ [NEXA NautaX]            [🌙/☀️]    │
├─────────────────────────────────────┤
│                                     │
│                                     │
│         [Spinner grande]            │
│                                     │
│         Conectando...               │
│                                     │
│         Esto puede tardar unos      │
│         segundos.                   │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ ● Conectando · Intento 1  [⋯]      │
└─────────────────────────────────────┘
```

La UI inferior permanece visible (footer con status), pero el content se reemplaza por loading.

---

## 6. Responsive behavior

### 6.1 Popup

- Tamaño fijo 380×520 — no responsive.
- TODO el contenido cabe en ese tamaño.
- Si el contenido no cabe, hay un problema de diseño — simplificar.

### 6.2 SidePanel

- Ancho variable (Chrome controla).
- Comportamientos:

| Ancho | Comportamiento |
|-------|----------------|
| < 320px | Nav colapsa a icons-only (sin labels) |
| 320-400px | Grid de cards 1 columna |
| 400-640px | Grid 2 columnas |
| > 640px | Grid 3 columnas |

### 6.3 Offscreen

- No responsive — no es visible.

---

## 7. Pendientes para Fases siguientes

### Fase 5
- Implementar PopupLayout y SidePanelLayout.
- Implementar NexaLogo, NexaButton, NexaCard, NexaStatusIndicator, NexaSpinner, NexaBanner.
- Implementar pantallas de Onboarding y Unlock (validar flujo crítico primero).
- Implementar popup states: logged out, connecting, connected, offline, error.

### Fase 7
- Implementar todas las pantallas del SidePanel (dashboard, accounts, scheduler, settings, developer mode).
- Implementar modales (account form, confirm dialogs).
- Implementar feature components en detalle.
- Pulir animaciones y transiciones.

### Fase 8
- Tests visuales / snapshot de cada screen en cada estado.
- Tests de responsive behavior del SidePanel.
- Validación de accesibilidad en cada screen.

---

**Fin del Documento 4.**
**Fin de la Fase 3.**

Esperando validación del usuario para iniciar Fase 4 (Data Model + Internal Services Design).
