# NEXA NautaX — ETECSA Connector Research Report

**Fase:** 1
**Documento:** 1 de 3
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22
**Fuente:** Investigación de 15 repositorios GitHub (3 batches paralelos)

> Documentos de soporte: `research-batch-1.md`, `research-batch-2.md`, `research-batch-3.md` (en este mismo directorio).

---

## 1. Resumen Ejecutivo

Se analizaron 15 repositorios públicos que implementan integración con servicios ETECSA Nauta. De ellos:

- **11 repositorios** son directamente relevantes para NEXA NautaX (implementan el flujo del portal cautivo de `secure.etecsa.net:8443`).
- **2 repositorios** son tangenciales (uno implementa el portal de usuario `nauta.cu:5002` que requiere captcha, otro es solo CRUD de cuentas sin login).
- **2 repositorios** son off-topic (un supervisor industrial Modbus y un app JHipster sin relación con Nauta).

### Hallazgo central

El flujo de autenticación del **portal cautivo ETECSA** está completamente triangulado entre al menos 7 repositorios independientes, lo que permite construir un connector estable sin necesidad de reingeniería desde cero. El flujo es:

```
[probe conectividad] → GET / → [parse form#formulario] → POST //LoginServlet →
[parse ATTRIBUTE_UUID] → POST /EtecsaQueryServlet (op=getLeftTime) →
POST /LogoutServlet (loggerId+username, remove=1)
```

### Hallazgos críticos

1. **`CSRFHW`** es un `<input type="hidden" name="CSRFHW">` con valor hex 32 chars, **no** un header ni cookie. Debe cosecharse en cada sesión nueva.
2. **`ATTRIBUTE_UUID`** es el token de sesión devuelto en el cuerpo HTML de respuesta al login. Se extrae con regex `ATTRIBUTE_UUID=(\w+)&CSRFHW=`. Es obligatorio para logout y para queries posteriores.
3. **`loggerId`** debe reescribirse como `loggerId+username` en el body de logout (comportamiento confirmado por 3 repositorios).
4. **`remove=1`** es parámetro obligatorio en logout; sin él el servidor no libera la sesión.
5. **Doble slash en `//LoginServlet`**: la URL canónica es `https://secure.etecsa.net:8443//LoginServlet` (con doble slash). No es un typo; el servidor lo requiere así.
6. **`wlanuserip`** es la IP del cliente detectada por ETECSA en el portal cautivo, devuelta en el form inicial. Debe reenviarse en login y logout. Cambia entre sesiones.
7. **Sin CAPTCHA en portal cautivo** (valida decisión D01). El portal de usuario `nauta.cu:5002` sí requiere captcha — se descarta para Fase 1.
8. **`EtecsaQueryServlet` con `op=getLeftTime`** devuelve texto plano `HH:MM:SS`. Con credenciales devuelve HTML `#sessioninfo` con saldo y expiración — esto permite **verificar credenciales sin establecer sesión de internet** (crítico para UX multi-cuenta D02).

### Riesgo principal

La extracción de saldo y expiración depende de **scraping HTML** (selectores `#sessioninfo`, formularios anidados). ETECSA no expone API estructurada para estos datos en el portal cautivo. Esto significa:

- **Riesgo alto** de rotura ante cambios HTML de ETECSA.
- Se requiere **strategy chain** (API → scraping → fallback) como exige la directiva NEXA.
- Se requiere **fixture corpus** (HTML muestras) para tests de regresión, inspirado en `suitetecsa-sdk-python`.

---

## 2. Tabla Comparativa de Repositorios

| # | Repo | Lang | Login | Logout | Balance | Time | Scraping | API | Calidad | Reutilizable |
|---|------|------|-------|--------|---------|------|----------|-----|---------|--------------|
| 1 | suitetecsa/suitetecsa-sdk-python | Python | ✓ | ✓ | ✓ | ✓ | BS4+html5lib | No | **Alta** | Arquitectura DI, fixtures, taxonomía errores |
| 2 | mmaciass/nauta-connect | JS/React MV2 | ✓ parcial | ✓ | ✗ | ✓ | cheerio | No | Media | Casi-extensión MV2 (deprecada) |
| 3 | Wachu985/Nauta-Project | Python/PyQt5 | ✓ | ✓ | ✓ | ✓ | BS4 | No | Media | Catálogo errores español, anti-patrón pickle |
| 4 | stickm4n/stickNAUTA | Python | ✓ | ✓ | ✓ | ✓ | regex/BS4 | No | **Alta** | Pre-login acquire_user_info, context manager |
| 5 | C-1412/control_center_etecsa | Python/Tkinter | ✓ | ✓ | ✓ | ✓ | BS4 | No | **Alta** | Verify-credentials-without-login, retry loop |
| 6 | mamei-tech/cnauta | Python+C# | ✓ | ✓ | ✓ | ✓ | regex | No | **Alta** | Enum PLoginResult, error codes canónicos |
| 7 | TheMrAleX/econnect | Python | ✓ | ✓ | ✗ | ✗ | regex | No | Baja | Anti-patrón credenciales plaintext |
| 8 | chenryhabana205/qvacall-cli | JS/Node | ✓ | ✓ | ✓ | ✓ | regex | No | **Alta** | Harvest-all-inputs, alert regex unicode |
| 9 | jvila8512/etecsaApp | Java/JHipster | ✗ | ✗ | ✗ | ✗ | n/a | n/a | Off-topic | Nada |
| 10 | EtecsaCu/EtecsaNauta | React PWA | ✗ (portal usuario) | ✗ | ✗ | ✗ | Sí | JWT+captcha | Off-topic (Fase 1) | Documentación portal usuario futuro |
| 11 | RaynerCadrelo/pywifietecsa | Python/GTK | ✓ | ✓ | ✓ | ✓ | lxml XPath | No | Media | Anti-patrón INI plaintext, fórmula saldo→tiempo incorrecta |
| 12 | jorgeajimenezl/nauta-connect-gnome | GJS/JS | ✓ | ✓ | ✓ | ✓ | DOM | No | **Alta** | Single-file NautaSession, libsecret, online.do detection |
| 13 | roniel-rhack/nauta-connect-apk | Java/Android | ✓ | ✓ | ✓ | ✓ | Jsoup | No | Media | Parámetros mobile path, anti-patrones double-login, switch fallthrough |
| 14 | alexfdezsauco/Nothing.Nauta | C#/.NET | ✓ | ✓ | ✓ | ✓ | regex | No | **Muy Alta** | **ISessionHandler, ResponseProcessors chain, Polly retry — referencia arquitectónica primaria** |
| 15 | luiscib3r/todo | Flutter/Dart | ✗ | ✗ | ✗ | ✗ | n/a | n/a | Off-topic login | Result<T>, modelo NautaSession completo |

### Veredicto de referencias

- **Referencia arquitectónica primaria**: `alexfdezsauco/Nothing.Nauta` (C#/.NET) — por su interfaz `ISessionHandler`, cadena de `ResponseProcessors` y política de reintento Polly.
- **Referencia técnica primaria**: `suitetecsa/suitetecsa-sdk-python` — por su arquitectura DI, taxonomía de excepciones y corpus de fixtures HTML.
- **Referencia JavaScript/frontend**: `chenryhabana205/qvacall-cli` (Node) — por su estrategia "harvest all form inputs" y regex unicode para alertas ETECSA.
- **Referencia ergonómica**: `jorgeajimenezl/nauta-connect-gnome-extension` — por su detección de `online.do` para confirmar login exitoso y uso de libsecret para credenciales.

---

## 3. Endpoints Inventory (ETECSA Captive Portal)

Base URL: `https://secure.etecsa.net:8443`

### 3.1 — GET `/`

| Campo | Valor |
|-------|-------|
| **Método** | GET |
| **Propósito** | Obtener formulario de login inicial con `CSRFHW` y `wlanuserip` |
| **Headers críticos** | `User-Agent` (cualquier navegador estándar) |
| **Cookies establecidas** | `JSESSIONID` (predicción: Tomcat) |
| **Body respuesta** | HTML con `<form id="formulario" action="//LoginServlet" method="post">` |
| **Campos hidden a cosechar** | `CSRFHW`, `wlanuserip`, `loggerId`, `gotopage`, `successpage`, `lang`, `origin` (algunos opcionales según página) |
| **Uso en NEXA** | Step 0 obligatorio. No puede omitirse (los repos que lo omiten son frágiles). |

### 3.2 — POST `//LoginServlet` (nota el doble slash)

| Campo | Valor |
|-------|-------|
| **Método** | POST |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Propósito** | Autenticación con credenciales Nauta |
| **Body obligatorio** | `username`, `password`, `wlanuserip`, `CSRFHW`, `loggerId`, `lang=es` |
| **Body recomendado (full)** | + `gotopage`, `successpage`, `domain` (vacío o sufijo de dominio) |
| **Respuesta exitosa** | HTTP 200 + HTML que contiene `ATTRIBUTE_UUID=...&CSRFHW=...` en bloque `<script>` |
| **Respuesta fallida** | HTTP 200 + HTML con `<script>alert("...mensaje en español...")</script>` |
| **Uso en NEXA** | Login. Resultado tipado `LoginResult`. |

### 3.3 — POST `/EtecsaQueryServlet`

| Campo | Valor |
|-------|-------|
| **Método** | POST |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Propósito 1** | Consultar tiempo restante conectado |
| **Body (modo 1)** | `op=getLeftTime`, `CSRFHW`, `ATTRIBUTE_UUID`, `wlanuserip`, `username`, `loggerId`+`username` |
| **Respuesta 1** | Texto plano `HH:MM:SS` |
| **Propósito 2** | Consultar saldo y expiración de cuenta (sin necesidad de sesión internet activa) |
| **Body (modo 2)** | + credenciales (`username`, `password`) — verifica credenciales |
| **Respuesta 2** | HTML con `#sessioninfo` conteniendo `Saldo:`, `Bloqueo:`, etc. |
| **Uso en NEXA** | Modo 1 → `getTimeLeft()`. Modo 2 → `verifyCredentials()` (sin login pleno, ideal para Fase 7 "Agregar cuenta"). |

### 3.4 — POST `/LogoutServlet`

| Campo | Valor |
|-------|-------|
| **Método** | POST (algunos repos usan GET, pero POST es más seguro) |
| **Propósito** | Cerrar sesión activa |
| **Body obligatorio** | `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `username`, `loggerId` (donde `loggerId` = `loggerId+username` reescrito), `remove=1`, `op=logout` |
| **Respuesta** | HTML de confirmación. El servidor libera la sesión inmediatamente si `remove=1`. |
| **Uso en NEXA** | Logout. Si `remove=1` se omite, el servidor **no** libera la sesión — bug confirmado en 2 repos. |

### 3.5 — Conectividad probe (pre-flight)

No es endpoint ETECSA pero es parte del flujo:

- **Opción A**: `http://secure.etecsa.net:8443/` con `redirect: 'manual'` — si recibes 302 a `https://secure.etecsa.net:8443/?...` estás en portal cautivo.
- **Opción B**: `http://connectivitycheck.gstatic.com/generate_204` — si no devuelve 204, hay captive portal.
- **Opción C**: `http://1.1.1.1/captive-portal-test` — fallback simple.

NEXA debe usar **Opción A** como primaria y **Opción B** como fallback.

---

## 4. Flujo de Autenticación Canónico

```
┌──────────────────────────────────────────────────────────────┐
│ 1. PROBE conectividad                                         │
│    GET http://connectivitycheck.gstatic.com/generate_204      │
│    → 204 = hay internet (no necesita login)                   │
│    → 302/200 = portal cautivo activo                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. FETCH formulario inicial                                   │
│    GET https://secure.etecsa.net:8443/                        │
│    Headers: User-Agent estándar, Cookie: vacío                │
│    Respuesta: HTML con <form id="formulario">                 │
│    Cookies set: JSESSIONID                                    │
│    Hidden inputs: CSRFHW, wlanuserip, loggerId, gotopage,     │
│                   successpage, lang                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. POST LOGIN                                                 │
│    POST https://secure.etecsa.net:8443//LoginServlet          │
│    Body:                                                       │
│      username={usuario}@nauta.com.cu                          │
│      password={password}                                       │
│      wlanuserip={wlanuserip del form}                         │
│      CSRFHW={CSRFHW del form}                                 │
│      loggerId={loggerId del form}                             │
│      lang=es                                                   │
│      gotopage=/                                                │
│      successpage=                                              │
│      domain=                                                   │
│    Respuesta exitosa: HTML con <script> que contiene          │
│      ATTRIBUTE_UUID={token}&CSRFHW={csrf}                     │
│    Respuesta fallida: HTML con <script>alert("...")</script>  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. PARSE respuesta                                            │
│    Regex: /ATTRIBUTE_UUID=(\w+)&CSRFHW=/                      │
│    Si match → sesión iniciada                                 │
│    Si no match → buscar alert("...")                          │
│      Regex: /alert\("([\w ().\p{L}]+)"\)/u                    │
│      Mapear mensaje español → EtecsaErrorCode                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. OPCIONAL: Consultar tiempo restante                        │
│    POST https://secure.etecsa.net:8443/EtecsaQueryServlet     │
│    Body: op=getLeftTime, CSRFHW, ATTRIBUTE_UUID,              │
│          wlanuserip, username, loggerId+username              │
│    Respuesta: "01:23:45" (HH:MM:SS)                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. LOGOUT                                                     │
│    POST https://secure.etecsa.net:8443/LogoutServlet          │
│    Body:                                                       │
│      ATTRIBUTE_UUID={token}                                   │
│      CSRFHW={csrf}                                            │
│      wlanuserip={ip}                                          │
│      username={usuario}@nauta.com.cu                          │
│      loggerId={loggerId+username reescrito}                   │
│      remove=1                                                 │
│      op=logout                                                │
│    Respuesta: HTML de confirmación                            │
└──────────────────────────────────────────────────────────────┘
```

### Variante — Verificación de credenciales sin login pleno

Para Fase 7 (Agregar cuenta), podemos usar el **modo 2** de `EtecsaQueryServlet`:

```
POST /EtecsaQueryServlet
Body: op=getLeftTime, CSRFHW, username, password, wlanuserip, ...
```

Si las credenciales son correctas, ETECSA devuelve HTML con `#sessioninfo` (saldo + expiración).
Si son incorrectas, devuelve alert con mensaje español.

Esto permite **validar credenciales al agregar cuenta** sin establecer sesión de internet, lo cual es ideal para UX multi-cuenta (D02) y no requiere logout posterior.

---

## 5. Catálogo de Errores ETECSA (español → código NEXA)

Triangulado desde los repositorios que mantienen catálogos de mensajes (`Wachu985/Nauta-Project`, `mamei-tech/cnauta`, `chenryhabana205/qvacall-cli`):

| Mensaje ETECSA (original) | Código NEXA | Categoría |
|---------------------------|-------------|-----------|
| `"El usuario o la contraseña son incorrectos."` | `AUTH_INVALID_CREDENTIALS` | AUTH_ERROR |
| `"Usted a realizado muchos intentos."` (nota: ETECSA escribe "a" en lugar de "ha") | `AUTH_RATE_LIMITED` | AUTH_ERROR |
| `"No existen saldos suficientes en la cuenta."` | `BALANCE_ZERO` | BALANCE_ERROR |
| `"La cuenta se encuentra bloqueada."` | `ACCOUNT_BLOCKED` | AUTH_ERROR |
| `"La sesión ha expirado."` | `SESSION_EXPIRED` | SESSION_ERROR |
| `"El usuario ya tiene una sesión activa."` | `ACCOUNT_IN_USE` | SESSION_ERROR |
| `"El portal no responde."` | `PORTAL_UNREACHABLE` | NETWORK_ERROR |
| `"No se pudo completar la operación."` | `UNKNOWN_ETECSA` | UNKNOWN |
| `"default"` (HTML sin alert específico) | `PARSER_ERROR` | CONNECTOR_ERROR |
| `"online.do"` (respuesta 200 vacía con redirect) | `LOGIN_SUCCESS` (no error) | OK |

> **Importante**: ETECSA tiene typos conocidos en sus mensajes (como "a realizado" en lugar de "ha realizado"). El parser debe usar **matching tolerante a typos** (distancia de Levenshtein o comparación normalizada sin acentos) o un set de strings equivalentes por cada código.

---

## 6. Análisis de Scraping y Fragilidad

### 6.1 Selectores críticos

| Selector | Propósito | Fragilidad |
|----------|-----------|------------|
| `form#formulario` | Form inicial de login | **Baja** — ID semántico, raro que cambie |
| `input[name=CSRFHW]` | Token CSRF | **Baja** — atributo `name` estable |
| `input[name=wlanuserip]` | IP del cliente | **Baja** |
| `input[name=loggerId]` | ID de logger | **Baja** |
| `/ATTRIBUTE_UUID=(\w+)&CSRFHW=/` | Token de sesión | **Media** — estructura de script inline |
| `/alert\("([\w ().\p{L}]+)"\)/u` | Mensaje de error | **Media** — atributo y comillas pueden cambiar |
| `#sessioninfo` | Bloque con saldo/expiración | **Alta** — ID genérico, puede renombrarse |
| `Saldo:\s*([\d,.]+)\s*CUP` | Saldo dentro de `#sessioninfo` | **Alta** — texto literal |
| `Bloqueo:\s*([\d/: ]+)` | Fecha de expiración | **Alta** |

### 6.2 Estrategia de mitigación

NEXA NautaX debe implementar **strategy chain** con degradación elegante:

1. **Strategy 1: Selector-based** (BeautifulSoup-equivalente en browser: `DOMParser` o `cheerio`-like nativo).
2. **Strategy 2: Regex fallback** sobre el HTML crudo.
3. **Strategy 3: Multiple selector variants** — mantener un array de selectores alternativos por campo (ej: `['#sessioninfo', '.session-info', 'div.balance-info']`).
4. **Strategy 4: Health reporting** — si Strategy 1 falla y Strategy 2 acierta, registrar en Developer Mode que el HTML cambió y notificar al usuario.

---

## 7. Análisis de Seguridad (cross-repo)

### 7.1 Antipatrones detectados (catálogo de qué NO hacer)

| Antipatrón | Repos afectados | Impacto |
|------------|-----------------|---------|
| Credenciales en texto plano (pickle/JSON/INI) | Wachu985, pywifietecsa, econnect, nauta-connect-apk | Crítico |
| AES con llave hardcoded | Ninguno lo hace bien | Crítico si se hace |
| `chrome.storage.sync` para credenciales | nauta-connect (planned) | Crítico — sync sube a la nube Google |
| `localStorage` para credenciales | stickNAUTA (web version), EtecsaNauta PWA | Alto |
| Logging de contraseña | stickNAUTA (debug mode) | Crítico |
| CSRFHW en URL query (GET logout) | Algunos repos antiguos | Medio — queda en logs proxy |
| `setInterval` en service worker | nauta-connect MV2 | Crítico para MV3 — SW muere |
| `chrome.notifications` nativas | Casi todos | Rompe branding NEXA |
| `cheerio` en browser context | nauta-connect | Bundle bloat, alternativas nativas mejores |
| Skip CMCCWLANFORM (pre-login) | mmaciass, Wachu985 | Frágil ante cambios de ETECSA |
| Throw en connector layer | Casi todos | Rompe flujo de error handling |
| Hardcoded `[13:-12]` slices | nauta-connect | Frágil ante cualquier cambio de string |
| Mixing UI + scraping + persistencia | La mayoría | Anti-arquitectura NEXA |
| `share_session` TCP server | stickNAUTA | Expone sesión localmente |
| Switch-statement fallthrough | nauta-connect-apk | Bugs de control flow |

### 7.2 Patrones a heredar

| Patrón | Repo origen | Justificación |
|--------|-------------|---------------|
| **DI con interfaces** (`NautaSession` abstracto) | suitetecsa-sdk-python | Permite mock para tests |
| **Taxonomía de excepciones** (`PortalLoginError`, `PortalLogoutError`, etc.) | suitetecsa-sdk-python | Errores tipados vs strings |
| **HTML fixtures para tests** | suitetecsa-sdk-python | Regresión reproducible |
| **Harvest all form inputs** (no hardcodear campos) | qvacall-cli | Robustez ante campos nuevos |
| **`online.do` redirect detection** | nauta-connect-gnome-extension | Confirmar login exitoso sin parseo HTML |
| **`libsecret` / OS keyring** | nauta-connect-gnome-extension | En NEXA → `chrome.storage.session` + PBKDF2 |
| **`ISessionHandler` interfaz** | Nothing.Nauta | Contrato limpio para strategies |
| **`ResponseProcessors` chain** | Nothing.Nauta | Pipeline de parseo extensible |
| **Polly retry con backoff exponencial** | Nothing.Nauta | Politica de reintentos profesional |
| **`loggerId+username` rewrite** | Nothing.Nauta, qvacall-cli | Sin esto, logout falla silenciosamente |
| **`remove=1` en logout** | Consenso | Sin esto, sesión no se libera |
| **Pre-login acquire_user_info** | stickNAUTA | Evita errores de CSRFHW expirado |
| **Cached time-left TTL** | stickNAUTA | Evita queries innecesarias |
| **Verify-without-login** | control_center_etecsa | UX multi-cuenta |
| **Context manager para sesión** | stickNAUTA | Cleanup garantizado |
| **Enum PLoginResult** | cnauta | Errores como datos, no excepciones |
| **Regex unicode `\p{L}`** | qvacall-cli | Matchea acentos en mensajes ETECSA |
| **Result<T,E> tipo** | luiscib3r/todo | Errores como valores |

---

## 8. Riesgos Identificados (consolidados)

| # | Riesgo | Severidad | Probabilidad | Mitigación NEXA |
|---|--------|-----------|--------------|-----------------|
| R1 | ETECSA cambia HTML de `#sessioninfo` | Alto | Alta | Strategy chain + fixtures + health reporting |
| R2 | ETECSA cambia mensaje de error español | Medio | Media | Matching tolerante a typos + Levenshtein |
| R3 | ETECSA introduce CAPTCHA en portal cautivo | Crítico | Baja | Detectar presencia de CAPTCHA → fallback a login asistido en UI |
| R4 | `JSESSIONID` cookie caduca entre steps | Alto | Media | Re-fetch del form inicial si recibe 302 |
| R5 | `wlanuserip` cambia entre probe y login | Medio | Baja | Re-fetch form inmediatamente antes de POST login |
| R6 | Rate limit ETECSA (mensaje "muchos intentos") | Medio | Alta con reconnect agresivo | Backoff exponencial obligatorio; cooldown tras 3 fallos |
| R7 | Sesión activa en otro dispositivo | Medio | Media | Detectar mensaje `ACCOUNT_IN_USE`; ofrecer opción "forzar logout remoto" |
| R8 | Service worker muere durante login | Alto | Alta (MV3) | Operaciones idempotentes + restart-safe (estado en storage) |
| R9 | Tokens en logs (debug) | Crítico | Baja | Sanitización regex en logger antes de persistir |
| R10 | Sincronización de cookies entre SW y UI | Medio | Baja | fetch con `credentials: 'include'` desde SW; no manipular cookies manualmente |
| R11 | Doble slash en URL `//LoginServlet` puede ser normalizado | Medio | Baja | Usar `new URL()` y deshabilitar normalización; fallback a URL hardcoded |
| R12 | Usuario confunde `@nauta.com.cu` vs `@nauta.co.cu` | Bajo | Alta | Auto-sugerir sufijo en UI |

---

## 9. Decisiones técnicas derivadas (binding para Fase 2)

Sobre la base de este análisis, como arquitecto establezco las siguientes decisiones que la Fase 2 (Arquitectura Técnica) deberá respetar:

| # | Decisión técnica | Justificación |
|---|------------------|---------------|
| F1-D1 | **Connector basado en `ISessionHandler` interfaz** con strategies intercambiables | Inspirado en Nothing.Nauta; permite testing con mock |
| F1-D2 | **Strategy chain**: KnownEndpoint → ScrapingRegex → ScrapingDOM → ManualFallback | Degradación elegante ante cambios ETECSA |
| F1-D3 | **`Result<T, EtecsaError>` tipo** — sin throws en connector | Errores como valores |
| F1-D4 | **`SessionData` branded type** con 9 campos obligatorios + 7 opcionales | Contrato estable |
| F1-D5 | **HTTP client propio** sobre `fetch` con timeout, retry y cookie jar implícito | No usar libs externas innecesarias |
| F1-D6 | **HTML parsing nativo** (`DOMParser`) — no `cheerio` ni `jsdom` | Bundle size + MV3 compliance |
| F1-D7 | **Fixture corpus** en `tests/fixtures/etecsa-html/` | Tests de regresión reproducibles |
| F1-D8 | **Catálogo de mensajes español** como dato (`etecsaMessages.ts`) | Tolerante a typos + fácil actualización |
| F1-D9 | **Logger sanitizador** con regex de patrones sensibles (passwords, CSRFHW, ATTRIBUTE_UUID, JSESSIONID) | Cumplir D04 + D08 |
| F1-D10 | **Verify-credentials endpoint** vía modo 2 de `EtecsaQueryServlet` | UX multi-cuenta (D02) sin sesiones paralelas |
| F1-D11 | **`online.do` detection** como señal secundaria de login exitoso | Robustez ante cambios de HTML de respuesta |
| F1-D12 | **HTTP probe + captive portal detection** antes de cualquier operación ETECSA | Validar D07 offline |

---

## 10. Pendientes para Fase 2

Las siguientes preguntas técnicas quedan diferidas a la Fase 2 (Arquitectura Técnica):

1. **Estructura exacta de `SessionData`** y su serialización a `chrome.storage.local`.
2. **Política de expiración de sesión local** (cuándo considerar una `SessionData` como stale).
3. **Estrategia de migración** cuando ETECSA cambie HTML (versionado de strategies).
4. **Modelo de events** entre SW y UI (tipos de mensajes, payload shapes).
5. **Diseño de `EtecsaError` jerarquía** (códigos, categorías, mensajes usuario, acción recomendada).
6. **Patrón de health reporting** al Developer Mode (métricas, sampling, retención).

---

**Fin del Documento 1.**
Continúa en `02-nexa-connector-architecture-proposal.md`.
