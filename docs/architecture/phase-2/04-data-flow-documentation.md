# NEXA NautaX — Data Flow Documentation

**Fase:** 2
**Documento:** 4 de 4
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22

> Documentación de los flujos críticos de NEXA NautaX. Cada flujo incluye: trigger, secuencia, participantes, eventos publicados, estado resultante, y edge cases. **No es implementación** — es especificación.

---

## 1. Flujo: Login (manual, desde Popup)

### 1.1 Trigger

Usuario hace click en "Conectar" en el Popup tras seleccionar cuenta e ingresar credenciales (o usando credenciales guardadas).

### 1.2 Precondiciones

- `crypto.isLocked() === false` (si no, flujo de Unlock primero).
- `connectionMonitor.getCurrentState()` ∈ `['CAPTIVE_PORTAL', 'SESSION_EXPIRED']`.
- `sessionManager.getActiveSession() === null`.
- `accountManager.getSelected() !== null`.

### 1.3 Secuencia

```
┌──────────┐                     ┌──────────┐                  ┌─────────────┐
│   Popup  │                     │    SW    │                  │  ETECSA     │
│  (React) │                     │ (MessageBus)│                │  Portal    │
└────┬─────┘                     └────┬─────┘                  └──────┬──────┘
     │                                │                                │
     │ 1. Click "Conectar"            │                                │
     │ (con accountId seleccionado)   │                                │
     │                                │                                │
     ├───────────────────────────────►│                                │
     │ sendMessage({                  │                                │
     │   type: 'SESSION_LOGIN',       │                                │
     │   accountId                    │                                │
     │ })                             │                                │
     │                                │                                │
     │                                │ 2. SessionManager.handleLogin  │
     │                                ├───────► (verifica precond.)    │
     │                                │                                │
     │                                │ 3. accountManager.getById()    │
     │                                │    → obtiene Account           │
     │                                │                                │
     │                                │ 4. cryptoService.decrypt(      │
     │                                │       account.encryptedPwd)    │
     │                                │    → plaintextPassword         │
     │                                │    (en memoria solo este momento)│
     │                                │                                │
     │                                │ 5. connector.login({           │
     │                                │       username, password,      │
     │                                │       accountType: 'prepaid'   │
     │                                │    })                          │
     │                                ├───────────────────────────────►│
     │                                │                                │
     │                                │                                │ 6. GET / (formulario)
     │                                │                                │    → CSRFHW, wlanuserip
     │                                │                                │
     │                                │                                │ 7. POST //LoginServlet
     │                                │                                │    (body: username, password,
     │                                │                                │     CSRFHW, wlanuserip, ...)
     │                                │                                │
     │                                │                                │ 8. Respuesta HTML:
     │                                │                                │    - Éxito: ATTRIBUTE_UUID=...
     │                                │                                │    - Fallo: alert("...")
     │                                │◄───────────────────────────────┤
     │                                │                                │
     │                                │ 9. Strategy chain procesa HTML │
     │                                │    (vía Offscreen doc)         │
     │                                │    → Result<SessionData>       │
     │                                │                                │
     │                                │ 10. Si éxito:                  │
     │                                │     - storage.set(             │
     │                                │         nexa.sessions.active,  │
     │                                │         SessionData)           │
     │                                │     - historyRepo.add(record)  │
     │                                │     - publish SESSION_STARTED  │
     │                                │     - notification.updateIcon( │
     │                                │         'connected')           │
     │                                │     - publish CONNECTOR_       │
     │                                │       OPERATION_SUCCESS        │
     │                                │                                │
     │                                │ 11. Si fallo:                  │
     │                                │     - publish CONNECTOR_       │
     │                                │       OPERATION_FAILURE        │
     │                                │     - notification.error(...)  │
     │                                │     - NO persistir nada        │
     │                                │                                │
     │                                │ 12. Eliminar plaintextPassword │
     │                                │     de memoria                 │
     │                                │                                │
     │◄───────────────────────────────┤                                │
     │ 13. Response:                  │                                │
     │   { ok: true, data: session }  │                                │
     │   o                            │                                │
     │   { ok: false, error: NexaErr }│                                │
     │                                │                                │
     │ 14. storage.onChanged dispara  │                                │
     │     (nexa.sessions.active)     │                                │
     │     → sessionStore actualiza   │                                │
     │     → React re-renderiza       │                                │
     │     → UI muestra "Conectado"   │                                │
     │                                │                                │
```

### 1.4 Eventos publicados

| Evento | Cuándo | Suscriptores |
|--------|--------|--------------|
| `CONNECTOR_OPERATION_SUCCESS` | Tras step 9 exitoso | DiagnosticEngine |
| `SESSION_STARTED` | Tras step 10 | NotificationEngine, SchedulerEngine, DiagnosticEngine |
| `CONNECTOR_OPERATION_FAILURE` | Tras step 11 fallo | DiagnosticEngine |
| (notification icon update) | Tras step 10/11 | via NotificationEngine |

### 1.5 Estado resultante

- **Éxito**: `nexa.sessions.active = SessionData`, `nexa.history[].append(record)`.
- **Fallo**: `nexa.sessions.active = null`, `nexa.sessions.lastError = NexaError`.

### 1.6 Edge cases

| Caso | Manejo |
|------|--------|
| SW muere entre step 5 y 9 | La promesa del connector se cancela. UI recibe timeout (15s). Estado queda `null`. Usuario puede reintentar. |
| Credenciales incorrectas | Step 8 devuelve HTML con `alert("...incorrectos...")`. ErrorMapper lo mapea a `AUTH_INVALID_CREDENTIALS`. NotificationEngine muestra toast "Credenciales incorrectas". |
| Rate limited por ETECSA | Step 8 devuelve HTML con alert "muchos intentos". ErrorMapper → `AUTH_RATE_LIMITED`. Toast de advertencia. No reintentar automáticamente. |
| Sin saldo (saldo 0) | Step 8 puede devolver HTML con alert "saldos suficientes" o HTML sin ATTRIBUTE_UUID pero con `online.do` redirect. Strategy chain detecta. Error `BALANCE_ZERO`. |
| Sesión ya activa en otro dispositivo | Step 8 devuelve HTML con alert "sesión activa". Error `SESSION_IN_USE`. UI ofrece opción "Forzar logout remoto" que llama a `connector.logout()` con sesión ficticia. |
| ETECSA no responde | fetch timeout (15s). Error `NETWORK_TIMEOUT`. Retry policy del HttpClient aplica (3 retries con backoff). Si todos fallan, error al usuario. |
| Captive portal pero ETECSA caído | Probe B devuelve 200 pero sin `formulario`. Strategy chain no puede parsear. Error `CONNECTOR_PARSER_FAILED`. Toast de error. Developer Mode muestra HTML recibido. |
| Master password no ingresada (locked) | Precondition check falla. UI muestra pantalla de Unlock primero. |

---

## 2. Flujo: Logout (manual, desde Popup o SidePanel)

### 2.1 Trigger

Usuario hace click en "Desconectar" en Popup o SidePanel.

### 2.2 Precondiciones

- `sessionManager.getActiveSession() !== null`.

### 2.3 Secuencia

```
┌──────────┐                     ┌──────────┐                  ┌─────────────┐
│   UI     │                     │    SW    │                  │  ETECSA     │
└────┬─────┘                     └────┬─────┘                  └──────┬──────┘
     │                                │                                │
     │ 1. Click "Desconectar"         │                                │
     ├───────────────────────────────►│                                │
     │ sendMessage({                  │                                │
     │   type: 'SESSION_LOGOUT'       │                                │
     │ })                             │                                │
     │                                │                                │
     │                                │ 2. sessionManager.handleLogout │
     │                                │    - leer activeSession        │
     │                                │                                │
     │                                │ 3. connector.logout(session)   │
     │                                ├───────────────────────────────►│
     │                                │                                │
     │                                │                                │ 4. POST /LogoutServlet
     │                                │                                │    (body: ATTRIBUTE_UUID,
     │                                │                                │     CSRFHW, wlanuserip,
     │                                │                                │     username, loggerId+username,
     │                                │                                │     remove=1, op=logout)
     │                                │                                │
     │                                │                                │ 5. Respuesta HTML confirmación
     │                                │◄───────────────────────────────┤
     │                                │                                │
     │                                │ 6. Si éxito:                   │
     │                                │    - historyRepo.closeCurrent()│
     │                                │      (set endTime, duration)   │
     │                                │    - storage.remove(           │
     │                                │        nexa.sessions.active)   │
     │                                │    - publish SESSION_LOST      │
     │                                │      (reason: 'manual')        │
     │                                │    - notification.updateIcon(  │
     │                                │        'disconnected')         │
     │                                │    - scheduler.cancelSession   │
     │                                │      Tasks()                   │
     │                                │                                │
     │                                │ 7. Si fallo:                   │
     │                                │    - Si SESSION_NOT_FOUND:     │
     │                                │      tratar como éxito (sesión │
     │                                │      ya cerrada)               │
     │                                │    - Si otro error: notificar  │
     │                                │      pero igual limpiar estado │
     │                                │      local (no podemos forzar  │
     │                                │      logout remoto)            │
     │                                │                                │
     │◄───────────────────────────────┤                                │
     │ 8. Response ok                 │                                │
     │                                │                                │
     │ 9. storage.onChanged:          │                                │
     │    nexa.sessions.active → null │                                │
     │    → sessionStore actualiza    │                                │
     │    → UI muestra "Desconectado" │                                │
     │                                │                                │
```

### 2.4 Edge cases

| Caso | Manejo |
|------|--------|
| Logout HTTP falla pero sesión local ya expiró | `SESSION_NOT_FOUND` → tratar como éxito. Limpiar estado local. |
| Usuario cierra el navegador sin logout | Sesión ETECSA queda abierta en servidor. En próxima apertura, `ConnectionMonitor` detecta `AUTHENTICATED` state si las cookies persistieron. Ofrecer "Cerrar sesión pendiente". |
| Logout concurrente (otra pestaña) | Detección por storage events. El segundo logout recibe `SESSION_NOT_FOUND`. OK. |

---

## 3. Flujo: Auto-Reconnect

### 3.1 Trigger

Evento `SESSION_LOST` publicado con `reason !== 'manual'` (ej: `connection_lost`, `session_expired`, `balance_zero`).

### 3.2 Precondiciones

- Cuenta activa tenía `reconnectPolicy.enabled === true`.
- `reconnectPolicy.onZeroBalance === 'switch'` O `reason !== 'balance_zero'`.

### 3.3 Secuencia

```
                  ┌─────────────────────────────────┐
                  │  SESSION_LOST event             │
                  │  (publicado por ConnectionMon.) │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │  SessionManager.handleSessionLost│
                  │                                   │
                  │  - Leer activeSession             │
                  │  - Si null, return (nada que     │
                  │    reconectar)                    │
                  │  - Leer account de activeSession │
                  │  - Leer reconnectPolicy           │
                  │                                   │
                  │  - Si policy.enabled === false:  │
                  │      publish SESSION_LOST final  │
                  │      return                      │
                  │                                   │
                  │  - Si reason === 'balance_zero'  │
                  │      Y policy.onZeroBalance      │
                  │      === 'stop':                 │
                  │      publish SESSION_LOST        │
                  │      return                      │
                  └────────────────┬─────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │  Bucle de reintentos             │
                  │  (hasta maxRetries)               │
                  │                                   │
                  │  for attempt = 1 to maxRetries:  │
                  │    delay = computeBackoff(        │
                  │      attempt, policy)             │
                  │    await sleep(delay)             │
                  │                                   │
                  │    connectionState =              │
                  │      await connection.probe()     │
                  │    if state !== CAPTIVE_PORTAL    │
                  │      Y state !== SESSION_EXPIRED: │
                  │      continue (no intentar)      │
                  │                                   │
                  │    result = await                 │
                  │      sessionManager.reconnect()   │
                  │                                   │
                  │    if result.ok:                  │
                  │      publish SESSION_REFRESHED    │
                  │      if policy.notifyOnReconnect:│
                  │        notification.success(      │
                  │          'Reconectado',           │
                  │          `Intento ${attempt}`)    │
                  │      return                       │
                  │                                   │
                  │  // Si todos los intentos fallaron│
                  │  publish SESSION_LOST final       │
                  │  notification.warning(            │
                  │    'No se pudo reconectar',       │
                  │    `${maxRetries} intentos        │
                  │     fallidos`)                    │
                  └─────────────────────────────────┘
```

### 3.4 Backoff calculation

```typescript
function computeBackoff(attempt: number, policy: ReconnectPolicy): number {
  const base = policy.initialDelayMs;
  switch (policy.backoffStrategy) {
    case 'fixed':
      return base;
    case 'exponential':
      // base * 2^(attempt-1), capped at maxDelayMs
      const raw = base * Math.pow(2, attempt - 1);
      return Math.min(raw, policy.maxDelayMs);
  }
}
```

Ejemplo con defaults (`initialDelayMs=30000`, `maxDelayMs=300000`, `maxRetries=3`):

- Attempt 1: 30s
- Attempt 2: 60s
- Attempt 3: 120s

### 3.5 Edge cases

| Caso | Manejo |
|------|--------|
| SW muere durante el sleep | El sleep se cancela. Al revivir el SW, no hay timer pendiente. La próxima heartbeat (60s) detecta `SESSION_LOST` nuevamente e inicia nuevo ciclo de reconnect desde attempt 1. |
| Conexión vuelve durante sleep pero se pierde antes del attempt | El attempt falla. Bucle continúa. |
| Usuario hace logout manual durante reconnect | Cancelar bucle (flag atómico en storage). |
| `onZeroBalance === 'switch'` y hay otra cuenta con saldo | Switch automático: seleccionar otra cuenta, llamar login. Si éxito, `SESSION_STARTED` con nueva cuenta. Si no hay otra cuenta, `SESSION_LOST` final. |

---

## 4. Flujo: Switch de Cuenta

### 4.1 Trigger

Usuario selecciona "Cambiar a cuenta X" en el SidePanel (Accounts module) o Popup (si multiple cuentas).

### 4.2 Precondiciones

- `accountManager.list().length > 1`.
- Cuenta destino existe.

### 4.3 Secuencia

```
1. Usuario click "Cambiar" en cuenta X
   │
   ▼
2. UI sendMessage ACCOUNT_SELECT { accountId: X }
   │
   ▼
3. accountManager.select(X)
   - Si hay sesión activa con cuenta Y:
     a. sessionManager.logout()  (flujo de logout normal)
     b. Esperar a que se complete
   - storage.set(nexa.accounts.selectedId, X)
   - publish ACCOUNT_SELECTED
   │
   ▼
4. UI pregunta: "¿Conectar ahora con cuenta X?"
   - Si sí: sessionManager.login(X)  (flujo de login normal)
   - Si no: solo cambia selección, sin login
   │
   ▼
5. UI muestra cuenta X como seleccionada
```

### 4.4 Edge cases

- Logout de cuenta Y falla pero sesión está realmente cerrada: continuar con selección de X.
- Usuario cancela a mitad del switch: la cuenta seleccionada ya es X, pero no hay login. UI muestra "Seleccionada pero no conectada".
- Cuenta X no tiene credenciales válidas: login falla con `AUTH_INVALID_CREDENTIALS`. UI ofrece editar cuenta X.

---

## 5. Flujo: Scheduler (logout programado)

### 5.1 Trigger — Creación de tarea

Usuario en SidePanel → Scheduler → "Desconectar en 60 minutos" → Confirmar.

### 5.2 Secuencia — Creación

```
1. UI sendMessage SCHEDULER_CREATE_TASK {
     type: 'LOGOUT_TIMER',
     trigger: { kind: 'delay', minutes: 60 },
     enabled: true
   }
   │
   ▼
2. schedulerEngine.createTask(input)
   - Generar taskId
   - Persistir SchedulerTask en nexa.scheduler.tasks[]
   - chrome.alarms.create(
       `nexa.scheduler.${taskId}`,
       { delayInMinutes: 60 }
     )
   - publish SCHEDULER_TASK_CREATED (si existe este evento, sino log only)
   │
   ▼
3. Response ok con taskId
   │
   ▼
4. UI muestra tarea en lista "Tareas activas"
   - "Logout en 60 min" (cuenta regresiva en UI)
```

### 5.3 Trigger — Ejecución de tarea

`chrome.alarms.onAlarm` se dispara con `alarm.name === 'nexa.scheduler.{taskId}'`.

### 5.4 Secuencia — Ejecución

```
1. SW.onAlarm(alarm)
   - Identificar que es scheduler alarm por prefijo
   - Llamar schedulerEngine.handleAlarm(alarm.name)
   │
   ▼
2. schedulerEngine.handleAlarm
   - Extraer taskId de alarm.name
   - Leer SchedulerTask de storage
   - Si task.enabled === false: marcar 'cancelled', return
   - Marcar task.status = 'executing'
   - publish SCHEDULER_TASK_FIRED
   │
   ▼
3. Según task.type:
   - LOGOUT_TIMER: sessionManager.logout()
   - LOGOUT_TIME: sessionManager.logout()
   - MAX_SESSION_TIME: sessionManager.logout()
   (todos llaman logout en este flujo)
   │
   ▼
4. Si logout ok:
   - task.status = 'completed'
   - task.executedAt = now
   - publish SCHEDULER_TASK_COMPLETED (success: true)
   - notification.info('Desconexión programada completada')
   │
   4b. Si logout falla:
   - task.status = 'failed'
   - task.lastError = NexaError
   - publish SCHEDULER_TASK_COMPLETED (success: false)
   - notification.warning('Desconexión programada falló', error.userMessage)
   │
   ▼
5. Persistir task actualizado
```

### 5.5 Edge cases

| Caso | Manejo |
|------|--------|
| SW no estaba vivo cuando se disparó alarm | Chrome revive SW para manejar alarm. Bootstrap se ejecuta, handler se registra, alarm se procesa. |
| Sesión ya estaba cerrada cuando se ejecuta | `logout()` recibe `SESSION_NOT_FOUND`. Se trata como éxito. Task marcado `completed`. |
| Usuario cancela tarea antes de que se ejecute | `chrome.alarms.clear(alarmName)`. Task marcado `cancelled`. |
| `chrome.alarms` pierde precisión (hasta 1min de delay) | Aceptado. UI muestra "aproximadamente a las HH:MM". |
| Navegador cerrado cuando se dispara alarm | Alarm NO se ejecuta. En próximo `onStartup`, schedulerEngine recorre tasks pendientes y los ejecuta si su tiempo ya pasó (con advertencia al usuario). |

---

## 6. Flujo: Offline Mode

### 6.1 Trigger — Detección de offline

`ConnectionMonitor.probe()` retorna `OFFLINE`.

### 6.2 Secuencia — Detección y propagación

```
1. Heartbeat alarm (cada 60s) dispara probe
   │
   ▼
2. ConnectionMonitor.probe()
   - Probe A: fetch generate_204 → falla
   - Probe B: fetch secure.etecsa.net:8443 → falla
   - Probe C: fetch 1.1.1.1/cdn-cgi/trace → falla
   - Conclusión: OFFLINE
   │
   ▼
3. Si estado anterior era diferente:
   - storage.set(nexa.sessions.connectionState, 'OFFLINE')
   - publish CONNECTION_OFFLINE
   │
   ▼
4. CONNECTION_OFFLINE disparado:
   - sessionManager: si había sesión activa, marcar como 'sospechosa'
     (no publicar SESSION_LOST aún — puede ser intermitente)
   - notificationEngine: si cambio fue de ONLINE→OFFLINE, no mostrar toast
     (silencioso; usuario ya sabe que no hay internet)
   - sessionManager.reconnect loop: pausar (no intentar cuando OFFLINE)
   │
   ▼
5. UI: storage.onChanged dispara
   - sessionStore actualiza connectionState
   - React re-renderiza
   - UI muestra banner "Sin conexión con ETECSA"
   - Botones login/logout deshabilitados
   - CRUD cuentas, settings, history, developer mode — habilitados
```

### 6.3 Recuperación

```
1. Heartbeat alarm dispara probe
   - Probe A: 204 OK → ONLINE
   │
   ▼
2. publish CONNECTION_ONLINE
   - sessionManager: si había sesión 'sospechosa', hacer probe de sesión
     (si attributeUuid sigue válido, marcar AUTHENTICATED)
   - notificationEngine: silencioso (no molestar al usuario)
   - sessionManager.reconnect loop: reanudar si estaba pausado
   │
   ▼
3. UI: banner "Sin conexión" se quita
   - Botones login/logout habilitados (si demás precondiciones se cumplen)
```

### 6.4 Capacidades en offline (D07)

| Operación | Disponible | Razón |
|-----------|------------|-------|
| Login | ✗ | Requiere ETECSA |
| Logout | ✗ | Requiere ETECSA |
| Get balance | ✗ | Requiere ETECSA |
| CRUD cuentas | ✓ | Local |
| Ver historial | ✓ | Local |
| Cambiar settings | ✓ | Local |
| Developer Mode | ✓ | Local |
| Backup export | ✓ | Local |
| Backup import | ✓ | Local |
| Auto-reconnect | ✗ (pausado) | Sin sentido sin red |

---

## 7. Flujo: Master Password Unlock

### 7.1 Trigger — Apertura de extensión

Usuario abre el Popup o SidePanel y `cryptoStore.locked === true`.

### 7.2 Precondiciones

- `crypto.isInitialized() === true` (es decir, ya se hizo onboarding).
- `crypto.isLocked() === true`.

### 7.3 Secuencia

```
┌──────────┐                     ┌──────────┐
│   UI     │                     │    SW    │
└────┬─────┘                     └────┬─────┘
     │                                │
     │ 1. UI monta, cryptoStore      │
     │    hidrata desde storage      │
     │    - locked = true             │
     │    - hasMasterPassword = true  │
     │                                │
     │ 2. UI renderiza UnlockScreen   │
     │                                │
     │ 3. Usuario ingresa password    │
     │    Click "Desbloquear"         │
     ├───────────────────────────────►│
     │ sendMessage({                  │
     │   type: 'CRYPTO_UNLOCK',       │
     │   masterPassword               │
     │ })                             │
     │                                │
     │                                │ 4. cryptoService.unlock(pwd)
     │                                │    - Leer salt de storage.local
     │                                │    - PBKDF2(pwd, salt, 250000)
     │                                │      → 32 bytes raw key
     │                                │    - Importar como CryptoKey
     │                                │    - Leer verifier de storage.local
     │                                │    - decrypt(verifier) con llave
     │                                │    - Si 'NEXA_VERIFIER_v1' === OK
     │                                │    - storage.session.set(
     │                                │        nexa.crypto.aesKey,
     │                                │        rawBytes)
     │                                │    - publish CRYPTO_UNLOCKED
     │                                │
     │                                │ 5. Si verifier no coincide:
     │                                │    - NO persistir nada
     │                                │    - Return error
     │                                │      CRYPTO_INVALID_MASTER_PASSWORD
     │                                │    - Log warning (sin pwd)
     │                                │    - Incrementar contador de
     │                                │      intentos (rate limit local)
     │                                │
     │◄───────────────────────────────┤
     │ 6. Response ok o error         │
     │                                │
     │ 7. Si ok:                      │
     │    - cryptoStore.locked = false│
     │      (via storage.session.onChanged)│
     │    - UI renderiza pantalla principal│
     │                                │
     │ 7b. Si error:                  │
     │    - UI muestra error          │
     │    - Input se limpia           │
     │    - Si 3 fallos consecutivos: │
     │      cooldown de 30s           │
```

### 7.4 Edge cases

| Caso | Manejo |
|------|--------|
| Usuario olvida master password | No hay recuperación. Opción "Restablecer extensión" en settings que borra TODO (cuentas, settings, logs) y vuelve a onboarding. Mensaje claro: "Se perderán todos los datos". |
| 3 intentos fallidos | Cooldown local de 30s. Después de 3 cooldowns (9 intentos), cooldown extendido de 5min. |
| SW muere entre step 4 y persistir key | La key no se persistió. UI recibe timeout. Usuario reintente. |
| Browser cerrado durante sesión | storage.session se limpia. Próxima apertura requiere unlock. |
| Onboarding aún no hecho | UI muestra OnboardingFlow, no UnlockScreen. |

---

## 8. Flujo: Onboarding (crear master password)

### 8.1 Trigger

Primera apertura de la extensión. `crypto.isInitialized() === false`.

### 8.2 Secuencia

```
1. UI detecta hasMasterPassword = false
   - Renderiza OnboardingFlow

2. Pantalla 1: Explicación
   "NEXA NautaX cifra tus credenciales localmente.
    Crea una contraseña maestra para protegerlas.
    Si la olvidas, no podrás recuperar tus cuentas."
   [Continuar]

3. Pantalla 2: Crear contraseña
   - Input: contraseña maestra
   - Validación en tiempo real:
     - Mínimo 8 caracteres
     - Advertencia (no bloqueo) si: < 12 chars, sin números, sin símbolos
   - Medidor de fortaleza visual
   [Siguiente]

4. Pantalla 3: Confirmar contraseña
   - Input: repetir contraseña
   - Debe coincidir
   [Crear]

5. UI sendMessage CRYPTO_CREATE_MASTER { masterPassword }
   │
   ▼
6. SW: cryptoService.createMasterPassword(pwd)
   - Generar salt aleatorio (16 bytes)
   - PBKDF2(pwd, salt, 250000) → 32 bytes raw key
   - Importar como CryptoKey AES-GCM
   - encrypt('NEXA_VERIFIER_v1') con la key → ciphertext
   - storage.local.set:
       nexa.crypto.salt = base64(salt)
       nexa.crypto.verifier = base64(ciphertext)
       nexa.crypto.kdfParams = { iterations, hash }
       nexa.crypto.createdAt = now
       nexa.meta.crypto.schemaVersion = 1
   - storage.session.set:
       nexa.crypto.aesKey = rawBytes
       nexa.crypto.derivedAt = now
   - publish CRYPTO_UNLOCKED (la key ya está disponible)
   │
   ▼
7. Response ok
   - cryptoStore.hasMasterPassword = true
   - cryptoStore.locked = false
   - UI redirige a pantalla principal
   - notification.success('¡Listo!', 'Cifrado activado.')
```

### 8.3 Edge cases

- Contraseñas no coinciden: UI bloquea "Crear", muestra error.
- SW muere entre step 6.a y 6.d: estado parcial. En próxima apertura, `crypto.isInitialized()` retorna true si `nexa.crypto.verifier` existe pero `nexa.crypto.salt` no → inconsistencia. Detectar y limpiar. Re-ofrecer onboarding.
- Usuario cierra popup a mitad: no se persistió nada. Próxima apertura vuelve a empezar.

---

## 9. Flujo: Theme Change

### 9.1 Trigger

Usuario selecciona tema en Settings → Appearance, o "Sistema".

### 9.2 Secuencia

```
1. Usuario click tema "Aurora"
   │
   ▼
2. UI sendMessage SETTINGS_UPDATE {
     theme: { mode: 'manual', theme: 'aurora' }
   }
   │
   ▼
3. SW: settingsStore actualiza nexa.settings.theme
   - storage.set(nexa.settings, updatedSettings)
   - (no publica evento — cambio de tema no es evento crítico)
   │
   ▼
4. storage.onChanged dispara en popup y sidepanel
   │
   ▼
5. ThemeService.apply('aurora') en cada surface
   - document.documentElement.setAttribute('data-theme', 'aurora')
   │
   ▼
6. CSS variables cambian
   - React no re-renderiza (cambio es CSS)
   - Transición suave via CSS transition en variables
```

### 9.3 Si modo "Sistema"

```
- settings.theme = { mode: 'system' }
- UI se suscribe a window.matchMedia('(prefers-color-scheme: dark)')
- Si dark → apply('dark')
- Si light → apply('light')
- Si cambia prefer-color-scheme → re-apply automáticamente
- Nebula y Aurora NO disponibles en modo sistema
```

### 9.4 Edge cases

- Tema persiste entre sesiones (en storage.local).
- Cada surface (popup, sidepanel) aplica tema independientemente pero lee del mismo storage — consistencia garantizada.
- Offscreen doc no tiene tema — no es visible.

---

## 10. Flujo: Diagnostics (logging y Developer Mode)

### 10.1 Trigger — Operación cualquiera

Cualquier servicio o connector llama a `diagnostics.info(...)`.

### 10.2 Secuencia

```
1. Service: diagnostics.info('session', 'Login iniciado', { accountId })
   │
   ▼
2. DiagnosticEngine.log(INFO, 'session', 'Login iniciado', { accountId })
   - Generar id (uuid)
   - Generar timestamp
   - Sanitizar message y details (F2-D18)
     - replace /password=[^&\s]+/gi → 'password=***'
     - replace /ATTRIBUTE_UUID=\w+/g → 'ATTRIBUTE_UUID=***'
     - replace /CSRFHW=\w+/g → 'CSRFHW=***'
     - replace emails → '***@***'
     - replace IPs → '***.***.***.***'
   - Construir LogEntry
   │
   ▼
3. storage: leer nexa.logs.entries[]
   - Si length >= 5000, shift() (eliminar más antiguo)
   - Push nuevo LogEntry
   - Escribir de vuelta
   - (operación atómica vía StorageEngine)
   │
   ▼
4. Si level es ERROR o FATAL:
   - publish event para NotificationEngine (opcional, según categoría)
   │
   ▼
5. storage.onChanged dispara
   - diagnosticStore actualiza logs (debounced 500ms para no spamear renders)
   - Si Developer Mode está abierto y en vista Logs:
     - React re-renderiza con nuevo log (respetando filtros activos)
```

### 10.3 Network records

Operaciones HTTP del connector también generan `NetworkRecord`:

```
1. HttpClient.request() antes de fetch:
   - Generar NetworkRecord con timestamp, method, url
   - status = null (pending)

2. Tras fetch completa:
   - Update NetworkRecord con status, durationMs, error?
   - Push a nexa.logs.network[] (capacidad 1000, FIFO)

3. Developer Mode → Network Debug muestra nexa.logs.network[]
```

### 10.4 Exportación de logs

```
1. UI: Developer Mode → Tools → "Exportar logs"
   │
   ▼
2. sendMessage DIAGNOSTIC_EXPORT
   │
   ▼
3. diagnosticEngine.export()
   - Leer todos los logs
   - Leer network records
   - Leer connector health
   - Serializar a JSON
   - Retornar blob
   │
   ▼
4. SW: chrome.downloads.download() o retornar data a UI para descarga
   - (chrome.downloads requiere permission — evaluar en Fase 8)
   - Alternativa: UI crea Blob URL y link de descarga
```

### 10.5 Sanitización — ejemplos

| Input | Output sanitizado |
|-------|-------------------|
| `password=abc123&user=pepe` | `password=***&user=***@***` |
| `ATTRIBUTE_UUID=abc123def456&CSRFHW=xyz` | `ATTRIBUTE_UUID=***&CSRFHW=***` |
| `Cookie: JSESSIONID=ABC123XYZ` | `Cookie: JSESSIONID=***` |
| `Connecting to 10.15.20.30` | `Connecting to ***.***.***.***` |
| `Login as user@nauta.com.cu` | `Login as ***@***` |

---

## 11. Flujo: Backup Export / Import

### 11.1 Export

```
1. UI: Settings → Backup → "Exportar todo"
   │
   ▼
2. sendMessage BACKUP_EXPORT
   │
   ▼
3. storageEngine.exportAll()
   - Leer todos los namespaces
   - Construir BackupPackage:
     {
       version: 1,
       createdAt: now,
       schemaVersions: { accounts: 1, sessions: 1, ... },
       data: {
         accounts: [...],     // IMPORTANTE: encryptedPassword incluido
                              // NO se descifra para backup
         settings: {...},
         history: [...],
         scheduler: [...],
         preferences: {...},
       }
     }
   - NO incluir:
     - nexa.crypto.* (salt, verifier, aesKey) — sensibles
     - nexa.logs.* — se exportan por separado si se quiere
   - Serializar a JSON
   │
   ▼
4. UI crea Blob URL y descarga como nexa-nautax-backup-YYYYMMDD.json
```

### 11.2 Import

```
1. UI: Settings → Backup → "Importar backup"
   - Usuario selecciona archivo .json
   │
   ▼
2. UI lee archivo, parsea JSON
   - Validar con Zod backupSchema
   - Si inválido: error "Archivo de backup inválido"
   │
   ▼
3. UI confirm: "Esto reemplazará todos tus datos actuales. ¿Continuar?"
   │
   ▼
4. sendMessage BACKUP_IMPORT { payload: parsedBackup }
   │
   ▼
5. storageEngine.importAll(payload)
   - Validar version compatible (version === 1)
   - Si schemaVersions difieren, ejecutar migrations
   - SIEMPRE requiere unlock antes de importar
     (las cuentas importadas tienen encryptedPassword
      que solo se puede descifrar con la key actual)
   - Clear todos los namespaces
   - Escribir nuevos datos
   - publish BACKUP_IMPORTED (nuevo evento)
   │
   ▼
6. UI: recargar página (o re-hidratar todos los stores)
   - notification.success('Backup importado correctamente')
```

### 11.3 Edge cases

| Caso | Manejo |
|------|--------|
| Backup de otra instalación | El encryptedPassword no se puede descifrar (salt y key diferentes). Error: "Backup de otra instalación. Las credenciales no se pueden migrar." |
| Versión de backup mayor a la actual | Error: "Backup requiere versión superior de NEXA NautaX." |
| Backup corrupto | Zod validation falla. Error al usuario. |
| Backup en medio de sesión activa | Logout automático antes de importar. |

---

## 12. Flujo: Connection Probe (heartbeat)

### 12.1 Trigger

`chrome.alarms.onAlarm` con `alarm.name === 'nexa.heartbeat'` (cada 60s).

### 12.2 Secuencia

```
1. SW: onAlarm handler
   - if (alarm.name === 'nexa.heartbeat') connection.probe()
   │
   ▼
2. ConnectionMonitor.probe()
   - stateBefore = getCurrentState()
   │
   ▼
3. Probe A: fetch('http://connectivitycheck.gstatic.com/generate_204',
                    { redirect: 'manual', signal: timeout(5s) })
   │
   ▼
4. Según respuesta:
   - 204 → newState = ONLINE
   - Cualquier otra → paso 5
   - Network error → paso 6
   │
   ▼
5. Probe B: fetch('https://secure.etecsa.net:8443/',
                    { signal: timeout(8s) })
   - 200 con HTML conteniendo 'formulario' → newState = CAPTIVE_PORTAL
   - 200 sin form → newState = ONLINE (raro)
   - Network error → paso 6
   │
   ▼
6. Probe C: fetch('http://1.1.1.1/cdn-cgi/trace',
                    { signal: timeout(5s) })
   - Responde → newState = ERROR (red existe pero ETECSA caído)
   - No responde → newState = OFFLINE
   │
   ▼
7. Si newState !== stateBefore:
   - storage.set(nexa.sessions.connectionState, newState)
   - publish event según newState:
     - ONLINE → CONNECTION_ONLINE
     - CAPTIVE_PORTAL → CONNECTION_CAPTIVE_PORTAL
     - OFFLINE → CONNECTION_OFFLINE
     - ERROR → (log only, no event)
   │
   ▼
8. Si stateBefore === AUTHENTICATED y newState !== ONLINE:
   - Sesión probablemente perdida
   - Publicar SESSION_LOST con reason='connection_lost'
   - (SessionManager maneja reconexión según policy)
```

### 12.3 Performance

- 3 probes en paralelo solo si los anteriores fallan (cascada).
- Timeouts cortos (5-8s) para no bloquear SW.
- Probe A suele ser suficiente el 90% de las veces.

---

## 13. Resumen de eventos por flujo

| Flujo | Eventos publicados |
|-------|-------------------|
| Login | `CONNECTOR_OPERATION_SUCCESS/FAILURE`, `SESSION_STARTED` |
| Logout | `SESSION_LOST` (reason='manual') |
| Auto-reconnect | `SESSION_REFRESHED` o `SESSION_LOST` final |
| Switch cuenta | `SESSION_LOST` (manual), `ACCOUNT_SELECTED`, posiblemente `SESSION_STARTED` |
| Scheduler | `SCHEDULER_TASK_FIRED`, `SCHEDULER_TASK_COMPLETED` |
| Offline | `CONNECTION_OFFLINE`, `CONNECTION_ONLINE` (recuperación) |
| Unlock | `CRYPTO_UNLOCKED` |
| Onboarding | `CRYPTO_UNLOCKED` (tras crear master) |
| Theme | (sin eventos — solo storage change) |
| Diagnostics | (sin eventos — solo storage change) |
| Backup | (sin eventos estándar — UI maneja) |
| Probe | `CONNECTION_ONLINE/OFFLINE/CAPTIVE_PORTAL` |

---

## 14. Diagrama de estados global

```
                    ┌──────────┐
                    │ UNKNOWN  │  (antes del primer probe)
                    └────┬─────┘
                         │ probe
                         ▼
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │  ONLINE  │          │ OFFLINE  │
        └────┬─────┘          └────┬─────┘
             │                     │
             │ (captive portal     │ (red vuelve)
             │  detectado)         │
             ▼                     │
        ┌──────────────┐           │
        │CAPTIVE_PORTAL│◄──────────┘
        └──────┬───────┘
               │ login
               ▼
        ┌──────────────┐
        │ CONNECTING   │
        └──────┬───────┘
               │
        ┌──────┴───────┐
        │              │
        ▼              ▼
   ┌────────────┐  ┌─────────┐
   │AUTHENTICATED│ │ ERROR   │
   └─────┬──────┘  └─────────┘
         │
         │ (sesión perdida)
         ▼
   ┌──────────────┐
   │SESSION_      │
   │EXPIRED       │
   └──────┬───────┘
          │
          │ (reconnect ok)
          ▼
   ┌──────────────┐
   │AUTHENTICATED │
   └──────────────┘
```

Transiciones no mostradas:
- Cualquier estado → OFFLINE (si pierde red).
- OFFLINE → CAPTIVE_PORTAL o ONLINE (al recuperar red).
- AUTHENTICATED → CAPTIVE_PORTAL (si sesión caduca en servidor).

---

## 15. Pendientes para Fases siguientes

### Fase 4
- Definir schemas Zod exactos para entidades mencionadas (`SessionData`, `Account`, `SchedulerTask`, `LogEntry`, `BackupPackage`, `NetworkRecord`, `ConnectorHealth`).
- Definir migrations iniciales (v1) por namespace.

### Fase 5
- Implementar skeleton de todos los servicios con interfaces vacías.
- Implementar EventBus y MessageBus.
- Implementar StorageEngine con repositories.

### Fase 6
- Implementar EtecsaConnector completo.
- Implementar OffscreenBridge para parsing HTML.
- Tests con fixtures.

### Fase 7
- Implementar UI que consume estos flujos via message bus.
- Developer Mode que muestra logs y network records en tiempo real.

### Fase 8
- Tests end-to-end de cada flujo con MockEtecsaConnector.
- Performance testing (especialmente heartbeat y storage writes).

---

**Fin del Documento 4.**
**Fin de la Fase 2.**

Esperando validación del usuario para iniciar Fase 3 (UX/UI Design System).
