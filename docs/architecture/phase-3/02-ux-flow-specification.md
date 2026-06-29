# NEXA NautaX — UX Flow Specification

**Fase:** 3
**Documento:** 2 de 4
**Autor:** Arquitecto NEXA NautaX + UX Lead
**Fecha:** 2026-06-22

> Especificación de los flujos de usuario. Cada flujo incluye: punto de entrada, pasos, decisiones, estados de error, y salida. **No es wireframe** — es contrato de comportamiento.

---

## 1. Convenciones

### 1.1 Nomenclatura de estados

| Estado | Significado |
|--------|-------------|
| `[initial]` | Estado inicial al abrir |
| `[loading]` | Cargando, mostrar skeleton/spinner |
| `[success]` | Operación exitosa |
| `[error]` | Operación fallida |
| `[empty]` | Sin datos |
| `[partial]` | Datos parciales (ej: hay cuentas pero no hay sesión activa) |

### 1.2 Estructura de cada flujo

Cada flujo documenta:

- **Trigger**: qué lo inicia.
- **Precondiciones**: qué debe cumplirse antes.
- **Pasos**: secuencia con estados UI.
- **Errores y recuperación**: qué pasa cuando algo falla.
- **Salidas**: dónde puede terminar el usuario.

---

## 2. Flujo: Onboarding (primera apertura)

### 2.1 Trigger

Usuario instala la extensión y la abre por primera vez. `crypto.isInitialized() === false`.

### 2.2 Precondiciones

- Extensión recién instalada.
- `nexa.crypto.verifier` no existe en storage.

### 2.3 Pasos

```
[initial]
  │
  ▼
┌─────────────────────────────────────┐
│ Pantalla 1: Bienvenida              │
│                                     │
│      [Logo NEXA grande]             │
│                                     │
│      NEXA NautaX                    │
│      Administra tus cuentas Nauta   │
│      con elegancia y seguridad.     │
│                                     │
│      [Comenzar]                     │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Pantalla 2: Por qué cifrado         │
│                                     │
│   [Icono Shield]                    │
│                                     │
│   Tus credenciales se cifran        │
│   localmente con AES-256.           │
│   Nosotros no podemos verlas.       │
│                                     │
│   Crea una contraseña maestra       │
│   para protegerlas.                 │
│                                     │
│   ⚠ Si la olvidas, no podrás        │
│   recuperar tus cuentas.            │
│                                     │
│   [Entendido]                       │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Pantalla 3: Crear contraseña        │
│                                     │
│   Contraseña maestra                │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│   Fortaleza: ●●●○○ Media            │
│                                     │
│   Confirmar contraseña              │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│                                     │
│   ☑ Entiendo que si olvido la      │
│     contraseña perderé mis cuentas │
│                                     │
│   [Crear y continuar]              │
└─────────────────────────────────────┘
  │
  ├── Si contraseñas no coinciden → toast error "Las contraseñas no coinciden"
  ├── Si fortaleza débil → warning inline (no bloqueante)
  ├── Si checkbox no marcado → button deshabilitado
  │
  ▼
[loading] — "Configurando cifrado..." (2-3s por PBKDF2)
  │
  ▼
┌─────────────────────────────────────┐
│ Pantalla 4: ¡Listo!                 │
│                                     │
│      [Icono CheckCircle grande]     │
│                                     │
│      Cifrado activado               │
│                                     │
│      Ahora agrega tu primera        │
│      cuenta Nauta para comenzar.    │
│                                     │
│      [+ Agregar cuenta]             │
│                                     │
│      [Omitir por ahora]             │
└─────────────────────────────────────┘
  │
  ├── Click "Agregar cuenta" → flujo "Agregar cuenta" (§7)
  └── Click "Omitir" → popup principal con empty state
```

### 2.4 Errores

| Error | Recuperación |
|-------|-------------|
| SW muere durante PBKDF2 | Recargar popup. Si `crypto.verifier` se persistió, va directo a unlock. Si no, vuelve a pantalla 3. |
| Storage lleno | Error crítico. Mostrar "Espacio insuficiente en el navegador". |

### 2.5 Salidas

- Usuario con master password creada y extensión desbloqueada.
- Puede continuar a agregar cuenta o saltar.

---

## 3. Flujo: Unlock (apertura posterior)

### 3.1 Trigger

Usuario abre popup o sidepanel y `crypto.isLocked() === true`.

### 3.2 Precondiciones

- `crypto.isInitialized() === true`.
- `crypto.isLocked() === true` (no hay llave en session storage).

### 3.3 Pasos

```
[initial]
  │
  ▼
┌─────────────────────────────────────┐
│ Unlock Screen                       │
│                                     │
│      [Logo NEXA]                    │
│                                     │
│      NEXA NautaX bloqueado          │
│                                     │
│      Ingresa tu contraseña maestra  │
│      para continuar.                │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ ●●●●●●●●●●●●            [👁]│   │
│   └─────────────────────────────┘   │
│                                     │
│   [Desbloquear]                     │
│                                     │
│   ¿Olvidaste tu contraseña?         │
│   Restablecer extensión             │
└─────────────────────────────────────┘
  │
  ├── Click "Restablecer extensión" → confirmación crítica (§3.5)
  │
  ▼
[loading] — "Desbloqueando..." (2-3s)
  │
  ├── Éxito → UI principal
  └── Fallo → ver §3.4
```

### 3.4 Errores

| Error | UI |
|-------|-----|
| Contraseña incorrecta | Input shake animation + toast error "Contraseña incorrecta". Limpiar input. |
| 3 intentos fallidos | Mostrar "Demasiados intentos. Espera 30s." Botón deshabilitado con countdown. |
| 9 intentos fallidos (3 cooldowns) | Cooldown extendido 5 min. Mensaje más severo. |

### 3.5 Restablecer extensión

```
┌─────────────────────────────────────┐
│ ⚠ Restablecer extensión              │
│                                     │
│ Esta acción eliminará PERMANENTEMENTE:│
│                                     │
│  • Todas tus cuentas guardadas      │
│  • Historial de sesiones            │
│  • Configuraciones                  │
│  • Logs                             │
│                                     │
│ Escribe RESTABLECER para confirmar: │
│                                     │
│ ┌─────────────────────────────┐     │
│ │                             │     │
│ └─────────────────────────────┘     │
│                                     │
│        [Cancelar]  [Restablecer]   │
│              (danger, disabled)     │
└─────────────────────────────────────┘
```

Solo se habilita el botón cuando el input es exactamente "RESTABLECER".

---

## 4. Flujo: Login (conectar sesión)

### 4.1 Trigger

Usuario en popup o sidepanel, sesión inactiva, presiona "Conectar".

### 4.2 Precondiciones

- Extensión desbloqueada.
- `sessionManager.getActiveSession() === null`.
- `connectionState` ∈ `['CAPTIVE_PORTAL', 'SESSION_EXPIRED']`.
- Hay al menos una cuenta seleccionada (o el usuario la selecciona).

### 4.3 Pasos

```
[initial: popup principal, sesión inactiva]
  │
  ▼
┌─────────────────────────────────────┐
│ [Logo NEXA]              [⚙ theme] │
│                                     │
│ No hay sesión activa                │
│                                     │
│ Cuenta:                             │
│ ┌─────────────────────────────┐     │
│ │ pepe@nauta.com.cu         ▼ │     │
│ └─────────────────────────────┘     │
│                                     │
│ Contraseña:                         │
│ ┌─────────────────────────────┐     │
│ │ ●●●●●●●●●●●●            [👁]│     │  ← opcional si ya está guardada
│ └─────────────────────────────┘     │
│                                     │
│ ☑ Recordar contraseña              │
│                                     │
│ [Conectar]                          │
│                                     │
│ ¿No tienes cuenta? [+ Agregar]     │
└─────────────────────────────────────┘
  │
  ├── Si contraseña vacía y no guardada → error inline
  ├── Si OFFLINE → botón deshabilitado + banner "Sin conexión"
  │
  ▼
[loading: "Conectando..." + spinner]
  │
  ├── Success (≤15s) → [success state]
  │
  ▼
┌─────────────────────────────────────┐
│ [Logo NEXA]              [⚙ theme] │
│                                     │
│ ● Conectado                         │
│                                     │
│ pepe@nauta.com.cu                   │
│                                     │
│ ┌─────────────┐  ┌─────────────┐   │
│ │ Tiempo       │  │ Saldo        │   │
│ │ 00:15:32     │  │ $25.50 CUP   │   │
│ │ conectado    │  │              │   │
│ └─────────────┘  └─────────────┘   │
│                                     │
│ [Desconectar]  [Abrir dashboard ▸] │
└─────────────────────────────────────┘
  │
  └── Toast success: "Sesión iniciada"
```

### 4.4 Errores

| Error code | UI |
|------------|-----|
| `AUTH_INVALID_CREDENTIALS` | Toast error "Credenciales incorrectas". Si contraseña fue ingresada manualmente, limpiar campo. |
| `AUTH_RATE_LIMITED` | Toast warning "ETECSA limitó los intentos. Espera unos minutos." Botón Conectar deshabilitado por 60s. |
| `BALANCE_ZERO` | Toast error "Saldo insuficiente." Sugerir cambiar cuenta. |
| `SESSION_IN_USE` | Dialog "La cuenta tiene sesión activa en otro dispositivo. ¿Forzar cierre remoto?" → si acepta, intenta logout remoto y reintenta login. |
| `NETWORK_TIMEOUT` | Toast error "Tiempo de conexión agotado. Reintentar?" con botón. |
| `NETWORK_OFFLINE` | Banner "Sin conexión con ETECSA". Botón deshabilitado. |
| `CONNECTOR_PARSER_FAILED` | Toast error "Portal ETECSA no disponible temporalmente." + "Ver Developer Mode" link. |

---

## 5. Flujo: Logout (desconectar)

### 5.1 Trigger

Usuario presiona "Desconectar" en popup o sidepanel.

### 5.2 Precondiciones

- `sessionManager.getActiveSession() !== null`.

### 5.3 Pasos

```
[initial: sesión activa]
  │
  ▼
[loading: "Desconectando..." 1-3s]
  │
  ├── Success → [logged out state]
  │
  ▼
┌─────────────────────────────────────┐
│ No hay sesión activa                │
│                                     │
│ Cuenta: pepe@nauta.com.cu         ▼ │
│                                     │
│ [Conectar]                          │
└─────────────────────────────────────┘
  │
  └── Toast info: "Sesión cerrada"
```

### 5.4 Errores

| Error | Manejo |
|-------|--------|
| `SESSION_NOT_FOUND` (ya cerrada) | Tratar como éxito. |
| `NETWORK_TIMEOUT` | Toast error "No se pudo confirmar el cierre. Es posible que la sesión siga activa en el servidor." Ofrecer "Cerrar localmente" que limpia estado local sin llamar a ETECSA. |
| Otros | Toast error. Estado local NO se limpia (usuario puede reintentar). |

---

## 6. Flujo: Switch de Cuenta

### 6.1 Trigger

Usuario selecciona otra cuenta en dropdown del popup o en lista del sidepanel.

### 6.2 Precondiciones

- Hay ≥ 2 cuentas guardadas.
- Extensión desbloqueada.

### 6.3 Pasos

```
[initial: sesión activa con cuenta A]
  │
  ▼
Usuario click en dropdown de cuenta
  │
  ▼
[dropdown open: lista de cuentas]
  │
  ▼
Usuario click en cuenta B
  │
  ├── Si sesión A activa:
  │   │
  │   ▼
  │   ┌─────────────────────────────────────┐
  │   │ Cambiar cuenta                      │
  │   │                                     │
  │   │ Tienes una sesión activa con        │
  │   │ pepe@nauta.com.cu.                  │
  │   │                                     │
  │   │ ¿Cerrar sesión actual y cambiar     │
  │   │ a maria@nauta.com.cu?               │
  │   │                                     │
  │   │ [Cancelar]  [Cerrar y cambiar]     │
  │   └─────────────────────────────────────┘
  │   │
  │   ├── Cancelar → no pasa nada
  │   └── Confirmar → logout A, seleccionar B
  │
  └── Si no hay sesión activa:
      │
      ▼
      Seleccionar cuenta B directamente
  │
  ▼
[loading: "Cerrando sesión..." si había activa]
  │
  ▼
[success: cuenta B seleccionada]
  │
  ▼
┌─────────────────────────────────────┐
│ Cuenta: maria@nauta.com.cu         ▼ │
│                                     │
│ No hay sesión activa                │
│                                     │
│ [Conectar]                          │
└─────────────────────────────────────┘
  │
  └── Toast info: "Cuenta cambiada"
```

### 6.4 Errores

| Error | Manejo |
|-------|--------|
| Logout A falla | Preguntar: "No se pudo cerrar la sesión actual. ¿Cambiar de todos modos?" Si sí, selección cambia; sesión A puede seguir activa en servidor. |
| Cuenta B no existe | Error raro. Refresh de UI. |

---

## 7. Flujo: Agregar Cuenta

### 7.1 Trigger

Usuario click "+ Agregar cuenta" en popup o sidepanel.

### 7.2 Precondiciones

- Extensión desbloqueada.

### 7.3 Pasos

```
[initial]
  │
  ▼
┌─────────────────────────────────────┐
│ ← Nueva cuenta                      │
│                                     │
│ Alias                               │
│ ┌─────────────────────────────┐     │
│ │ Cuenta personal             │     │
│ └─────────────────────────────┘     │
│                                     │
│ Usuario                             │
│ ┌─────────────────────────────┐     │
│ │ pepe@nauta.com.cu           │     │
│ └─────────────────────────────┘     │
│                                     │
│ Contraseña                          │
│ ┌─────────────────────────────┐     │
│ │ ●●●●●●●●●●●●            [👁]│     │
│ └─────────────────────────────┘     │
│                                     │
│ Tipo                                │
│ (●) Prepago                        │
│                                     │
│ Política de reconexión              │
│ ☑ Reconectar automáticamente       │
│   Reintentos máximos: [3 ▼]        │
│   Si saldo agotado: (●) Detener    │
│                   ( ) Cambiar cuenta│
│                                     │
│ ☐ Verificar credenciales ahora     │
│   (conecta a ETECSA para validar)  │
│                                     │
│ [Cancelar]  [Guardar]              │
└─────────────────────────────────────┘
  │
  ├── Validación inline en cada campo
  ├── Si "Verificar credenciales" marcado:
  │   │
  │   ▼
  │   [loading: "Verificando..." 3-10s]
  │   │
  │   ├── Success → mostrar saldo + fecha expiración en dialog
  │   │            "Cuenta válida. Saldo: $25.50 CUP. ¿Guardar?"
  │   │
  │   └── Fallo → toast error, NO bloquear guardado
  │                (usuario puede guardar igualmente)
  │
  ▼
[success: cuenta guardada]
  │
  ▼
Lista de cuentas muestra nueva cuenta
Toast success: "Cuenta guardada"
```

### 7.4 Validaciones

| Campo | Regla |
|-------|-------|
| Alias | 1-50 chars, no vacío |
| Usuario | Regex `^[a-zA-Z0-9._-]+(@nauta\.(com|co)\.cu)?$`. Si no incluye `@`, se asume `@nauta.com.cu`. |
| Contraseña | 1-100 chars, no vacía |
| Tipo | Solo 'prepaid' disponible en Fase 1 |

### 7.5 Errores

| Error | Manejo |
|-------|--------|
| Usuario duplicado | Error inline "Ya existe una cuenta con este usuario" |
| Verificación falla con `AUTH_INVALID_CREDENTIALS` | Toast error pero botón Guardar sigue habilitado ( usuario puede querer guardar igualmente) |
| Verificación falla con `NETWORK_OFFLINE` | Toast warning "No se puede verificar sin conexión". Checkbox se desmarca. |

---

## 8. Flujo: Editar Cuenta

### 8.1 Trigger

Usuario click "✎" en card de cuenta.

### 8.2 Precondiciones

- Cuenta existe.
- Extensión desbloqueada.

### 8.3 Pasos

```
┌─────────────────────────────────────┐
│ ← Editar cuenta                     │
│                                     │
│ Alias                               │
│ ┌─────────────────────────────┐     │
│ │ Cuenta personal             │     │
│ └─────────────────────────────┘     │
│                                     │
│ Usuario                             │
│ ┌─────────────────────────────┐     │
│ │ pepe@nauta.com.cu           │     │
│ └─────────────────────────────┘     │
│                                     │
│ Contraseña                          │
│ ┌─────────────────────────────┐     │
│ │ ●●●●●●●●●●●●   [Regenerar]  │     │  ← NUNCA mostrar plaintext
│ └─────────────────────────────┘     │
│                                     │
│ [Cancelar]  [Guardar cambios]      │
└─────────────────────────────────────┘
```

### 8.4 Reglas

- Contraseña **nunca** se muestra desencriptada. Solo se muestra "●●●●●" o similar.
- Botón "Regenerar" abre dialog para ingresar nueva contraseña.
- Si se cambia usuario, requiere re-verificación opcional.

---

## 9. Flujo: Eliminar Cuenta

### 9.1 Trigger

Usuario click "🗑" en card de cuenta.

### 9.2 Pasos

```
┌─────────────────────────────────────┐
│ ⚠ Eliminar cuenta                    │
│                                     │
│ ¿Eliminar "Cuenta personal"?        │
│                                     │
│ La cuenta pepe@nauta.com.cu         │
│ se eliminará permanentemente.        │
│                                     │
│ Si hay una sesión activa con esta   │
│ cuenta, se cerrará automáticamente. │
│                                     │
│ Escribe ELIMINAR para confirmar:    │
│                                     │
│ ┌─────────────────────────────┐     │
│ │                             │     │
│ └─────────────────────────────┘     │
│                                     │
│        [Cancelar]  [Eliminar]      │
│              (danger, disabled)     │
└─────────────────────────────────────┘
  │
  ├── Si sesión activa con esta cuenta:
  │   - Logout automático antes de eliminar
  │
  ▼
[success: cuenta eliminada]
Toast success: "Cuenta eliminada"
Lista se actualiza
```

---

## 10. Flujo: Programar Desconexión (Scheduler)

### 10.1 Trigger

Usuario en SidePanel → Scheduler → "Nueva programación".

### 10.2 Pasos

```
┌─────────────────────────────────────┐
│ ← Programar desconexión             │
│                                     │
│ Tipo                                │
│ (●) En X minutos                    │
│ ( ) A hora específica               │
│ ( ) Tiempo máximo de sesión         │
│                                     │
│ ─── En X minutos ───                │
│                                     │
│ Desconectar en:                     │
│ [30 min] [60 min] [120 min] [Custom]│
│                                     │
│ Tiempo estimado de cierre:          │
│ 14:32 (en ~60 minutos)              │
│                                     │
│ ☑ Notificar al desconectar          │
│                                     │
│ [Cancelar]  [Programar]             │
└─────────────────────────────────────┘
  │
  ▼
[success: tarea creada]
Lista de tareas activas:
┌─────────────────────────────────────┐
│ ⏱ Desconectar en 60 min             │
│   Cuenta: pepe@nauta.com.cu         │
│   Cierra aprox: 14:32               │
│                            [×]      │
└─────────────────────────────────────┘
Toast info: "Programación creada"
```

### 10.3 Variantes

- **Hora específica**: time picker.
- **Tiempo máximo**: input en horas (ej: 2 horas).

### 10.4 Cancelación

- Click en "×" de la tarea.
- Confirmación rápida: "¿Cancelar programación? [Sí] [No]".

---

## 11. Flujo: Cambiar Tema

### 11.1 Trigger

Usuario en SidePanel → Settings → Appearance.

### 11.2 Pasos

```
┌─────────────────────────────────────┐
│ Apariencia                          │
│                                     │
│ Tema                                │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │     │ │     │ │     │ │     │    │
│ │Dark │ │Light│ │Nebul│ │Auror│    │
│ │  ✓  │ │     │ │     │ │     │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                     │
│ ○ Sistema (solo Dark/Light)         │
│                                     │
│ Vista previa                        │
│ ┌─────────────────────────────┐     │
│ │ [Botón primary]             │     │
│ │ [Card de ejemplo]           │     │
│ │ ● Estado: Conectado         │     │
│ └─────────────────────────────┘     │
└─────────────────────────────────────┘
  │
  ├── Click en cualquier tema → aplica inmediatamente
  │   No necesita botón "Guardar"
  │
  └── Toast info sutil: "Tema cambiado"
```

---

## 12. Flujo: Backup Export

### 12.1 Trigger

Usuario en SidePanel → Settings → Backup → "Exportar todo".

### 12.2 Pasos

```
┌─────────────────────────────────────┐
│ Backup                              │
│                                     │
│ Exporta tus datos para migrar a     │
│ otro equipo o como respaldo.        │
│                                     │
│ Incluye:                            │
│  ✓ Cuentas (credenciales cifradas)  │
│  ✓ Configuraciones                  │
│  ✓ Historial                        │
│  ✓ Programaciones                   │
│                                     │
│ NO incluye:                         │
│  ✗ Logs (exportar por separado)     │
│  ✗ Llaves de cifrado                │
│                                     │
│ [Exportar todo]                     │
└─────────────────────────────────────┘
  │
  ▼
[loading: "Generando backup..."]
  │
  ▼
Download automático:
nexa-nautax-backup-2026-06-22.json
  │
  ▼
Toast success: "Backup descargado"
```

### 12.3 Notas

- El backup contiene credenciales **cifradas** con la llave actual.
- Solo se pueden descifrar con la misma master password.
- Si se importa en otra instalación con diferente master password, las credenciales NO se podrán descifrar.

---

## 13. Flujo: Backup Import

### 13.1 Trigger

Usuario en SidePanel → Settings → Backup → "Importar backup".

### 13.2 Pasos

```
[Seleccionar archivo .json]
  │
  ▼
[Validando formato...]
  │
  ├── Inválido → toast error "Archivo inválido"
  │
  ▼
┌─────────────────────────────────────┐
│ Importar backup                     │
│                                     │
│ Archivo: nexa-nautax-backup-...json │
│ Creado: 2026-06-15                  │
│ Versión: 1                          │
│                                     │
│ Cuentas: 3                          │
│ Historial: 45 registros             │
│                                     │
│ ⚠ Esto REEMPLAZARÁ todos tus datos  │
│ actuales. Esta acción no se puede   │
│ deshacer.                           │
│                                     │
│ ☑ Entiendo, importar de todos modos│
│                                     │
│ [Cancelar]  [Importar]              │
│            (danger, disabled)       │
└─────────────────────────────────────┘
  │
  ▼
[loading: "Importando..." 2-5s]
  │
  ├── Success → reload UI
  │   Toast success: "Backup importado"
  │
  └── Error → ver §13.3
```

### 13.3 Errores

| Error | Manejo |
|-------|--------|
| Versión de backup mayor | Error "Backup requiere versión superior de NEXA NautaX" |
| Backup de otra instalación (credenciales no descifrables) | Error "Backup de otra instalación. Las credenciales no se pueden migrar." Preguntar si importar sin credenciales. |
| Storage lleno | Error "Espacio insuficiente" |

---

## 14. Flujo: Developer Mode — Ver Logs

### 14.1 Trigger

Usuario en SidePanel → Developer Mode → Logs tab.

### 14.2 Pasos

```
┌──────────────────────────────────────────────────┐
│ Developer Mode                                   │
│ [Logs] [Session] [Connector] [Network] [Storage] │
│                                                  │
│ Filtros:                                         │
│ Level: [All ▼]  Category: [All ▼]  [🔍 Search]   │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 14:32:15  INFO  session    Login iniciado   │ │
│ │            details: { accountId: 'acc_123' } │ │
│ │ 14:32:17  DEBUG connector  Probe captive... │ │
│ │ 14:32:18  DEBUG connector  POST LoginServlet│ │
│ │ 14:32:20  INFO  session    Login completado │ │
│ │ 14:32:35  DEBUG scheduler  Heartbeat tick   │ │
│ │ 14:33:15  DEBUG connection Probe A: 204     │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [Refrescar] [Limpiar] [Exportar]                │
│                                                  │
│ Mostrando 6 de 4,521 logs                        │
└──────────────────────────────────────────────────┘
```

### 14.3 Comportamiento

- Auto-scroll al final si hay logs nuevos (a menos que user haya hecho scroll up).
- Filtrado en tiempo real.
- Click en log expande details.
- Auto-refresh cada 2s (configurable).

---

## 15. Flujo: Developer Mode — Tools

### 15.1 Trigger

Usuario en SidePanel → Developer Mode → Tools tab.

### 15.2 Pasos

```
┌─────────────────────────────────────┐
│ Developer Tools                     │
│                                     │
│ Connector                           │
│ [Test Login]  [Test Logout]         │
│                                     │
│ Storage                             │
│ [Limpiar caché]                     │
│                                     │
│ Logs                                │
│ [Exportar logs]  [Limpiar logs]     │
│                                     │
│ Estado                              │
│ [Reiniciar extensión]               │
│                                     │
│ Diagnóstico                         │
│ [Ejecutar full diagnostic]          │
└─────────────────────────────────────┘
```

### 15.3 Acciones

- **Test Login/Logout**: ejecuta login/logout con cuenta seleccionada y muestra resultado detallado (timing, strategy usada, response sanitizada).
- **Limpiar caché**: borra `chrome.storage.local` (con confirmación).
- **Exportar logs**: descarga JSON con todos los logs.
- **Reiniciar extensión**: `chrome.runtime.reload()`.
- **Full diagnostic**: ejecuta todos los probes y tests, genera reporte.

---

## 16. Flujo: Auto-Reconnect (background)

### 16.1 Trigger

`SESSION_LOST` event con `reason !== 'manual'`.

### 16.2 UX

```
[popup abierto, sesión cae]
  │
  ▼
┌─────────────────────────────────────┐
│ ● Reconectando...                   │
│                                     │
│ Intento 1 de 3                      │
│ Próximo intento en 30s              │
│                                     │
│ [Cancelar]                          │
└─────────────────────────────────────┘
  │
  ├── Toast warning: "Conexión perdida. Reintentando..."
  │
  ▼
Si éxito:
  │
  ▼
┌─────────────────────────────────────┐
│ ● Conectado                         │
│                                     │
│ Reconexión exitosa                  │
│ ...                                 │
└─────────────────────────────────────┘
  │
  └── Toast success: "Reconectado"

Si todos los intentos fallan:
  │
  ▼
┌─────────────────────────────────────┐
│ ● Desconectado                      │
│                                     │
│ No se pudo reconectar automáticamente│
│                                     │
│ [Reintentar] [Conectar manualmente]│
└─────────────────────────────────────┘
  │
  └── Toast error: "No se pudo reconectar"
```

### 16.3 Edge cases

- Si popup cerrado durante reconnect: el reconnect sigue en SW. Toast se muestra al reabrir.
- Si usuario hace click "Cancelar": el bucle se detiene. Estado final: disconnected.

---

## 17. Flujo: Offline Detection

### 17.1 Trigger

`ConnectionMonitor` detecta `OFFLINE`.

### 17.2 UX

```
┌─────────────────────────────────────┐
│ ⚠ Sin conexión con ETECSA           │  ← banner
│                                     │
│ Operaciones de ETECSA no            │
│ disponibles. Puedes seguir          │
│ gestionando cuentas localmente.     │
└─────────────────────────────────────┘
  │
  ▼
UI muestra:
- Botón "Conectar" deshabilitado con tooltip
- Botón "Desconectar" deshabilitado
- CRUD cuentas → disponible
- Historial → disponible
- Settings → disponible
- Developer Mode → disponible
```

### 17.3 Recuperación

Cuando `ONLINE` vuelve:

- Banner desaparece.
- Botones se rehabilitan.
- Si había `reconnectPolicy.enabled`, intenta reconnect automáticamente.
- Toast info sutil: "Conexión restablecida" (no invasivo).

---

## 18. Flujo: Sesión Expirada (background)

### 18.1 Trigger

`SESSION_LOST` event con `reason = 'session_expired'` (ETECSA cerró la sesión por timeout).

### 18.2 UX

```
[popup abierto]
  │
  ▼
┌─────────────────────────────────────┐
│ ● Sesión expirada                   │
│                                     │
│ ETECSA cerró la sesión.             │
│                                     │
│ [Reconectar] [Cerrar]               │
└─────────────────────────────────────┘
  │
  └── Toast warning: "La sesión ha expirado"
```

Si `reconnectPolicy.enabled` y `reason` permite:

- Auto-reconnect se inicia automáticamente.
- Popup muestra "Reconectando..." como en §16.

---

## 19. Flujo: Saldo Bajo (background)

### 19.1 Trigger

`BALANCE_LOW` event (saldo < threshold configurable, default 5 CUP).

### 19.2 UX

```
Toast warning persistente:
┌─────────────────────────────────────┐
│ ⚠ Saldo bajo                        │
│ Saldo actual: $4.50 CUP             │
│ Considera recargar tu cuenta.       │
└─────────────────────────────────────┘
```

- Auto-dismiss: 10s (más largo que toasts normales).
- Si popup estaba cerrado: badge en icono de extensión.
- SidePanel Dashboard: card de saldo con borde warning.

---

## 20. Flujo: Cerrar extensión con sesión activa

### 20.1 Trigger

Usuario cierra popup/sidepanel sin logout.

### 20.2 Comportamiento

- Sesión ETECSA sigue activa en servidor.
- SW sigue corriendo (en background) hasta que Chrome lo termine.
- Al reabrir popup: muestra estado "Conectado" con tiempo actualizado.
- Si Chrome se cierra completamente: SW muere. Sesión ETECSA puede seguir activa en servidor (depende de ETECSA).

### 20.3 Al reabrir Chrome

- `chrome.runtime.onStartup` se dispara.
- `SessionManager` lee `nexa.sessions.active` de storage.
- `ConnectionMonitor` hace probe.
  - Si `CAPTIVE_PORTAL` + sesión guardada: estado `SESSION_EXPIRED` (sesión probablemente caducó). Ofrecer reconectar.
  - Si `AUTHENTICATED`: sesión sigue viva (raro pero posible si cookies persistieron).
  - Si `OFFLINE`: banner offline.

---

## 21. Resumen de toasts por evento

| Evento | Toast |
|--------|-------|
| Login success | `success` "Sesión iniciada" |
| Login fail | `error` con mensaje específico |
| Logout success | `info` "Sesión cerrada" |
| Logout fail | `error` con acción "Cerrar localmente" |
| Reconnect success | `success` "Reconectado" |
| Reconnect all attempts fail | `error` "No se pudo reconectar" |
| Account created | `success` "Cuenta guardada" |
| Account deleted | `success` "Cuenta eliminada" |
| Scheduler task created | `info` "Programación creada" |
| Scheduler task fired | `info` "Desconectando según programación" |
| Balance low | `warning` "Saldo bajo" |
| Session expired | `warning` "La sesión ha expirado" |
| Connection lost | `warning` "Conexión perdida. Reintentando..." |
| Connection restored | `info` "Conexión restablecida" |
| Theme changed | `info` sutil "Tema cambiado" |
| Backup exported | `success` "Backup descargado" |
| Backup imported | `success` "Backup importado" |
| Connector degraded | `warning` "Portal ETECSA con problemas" |
| Master password created | `success` "Cifrado activado" |
| Master password changed | `success` "Contraseña maestra actualizada" |
| Unlock fail | `error` "Contraseña incorrecta" |

---

## 22. Pendientes para Fases siguientes

### Fase 4
- Validar que los inputs del formulario de cuenta matchean el schema Zod.

### Fase 5
- Implementar screens con estos flujos como guía.

### Fase 7
- Implementar cada flujo en código.
- Tests E2E de cada flujo crítico (login, logout, reconnect, multi-cuenta).

---

**Fin del Documento 2.**
Continúa en `03-component-inventory.md`.
