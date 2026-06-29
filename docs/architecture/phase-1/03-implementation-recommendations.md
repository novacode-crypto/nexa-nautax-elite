# NEXA NautaX — Implementation Recommendations

**Fase:** 1
**Documento:** 3 de 3
**Autor:** Arquitecto NEXA NautaX
**Fecha:** 2026-06-22
**Referencias:**
- Documento 1: `01-etecsa-connector-research-report.md`
- Documento 2: `02-nexa-connector-architecture-proposal.md`

> Este documento consolida las recomendaciones prácticas para las Fases 2-6. Define qué reutilizar de los repos investigados, qué antipatrones evitar, y el orden recomendado de implementación.

---

## 1. Qué Reutilizar (catálogo accionable)

### 1.1 De `alexfdezsauco/Nothing.Nauta` (referencia arquitectónica primaria)

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| Interfaz `ISessionHandler` | Renombrada a `IEtecsaConnector`. Misma firma conceptual. |
| `SessionDataKeys` constants | Centraliza nombres de campos en un solo archivo. NEXA lo adopta como `sessionDataKeys.ts`. |
| `ResponseProcessors` chain | Convertido en `Strategy Chain` (5 strategies). Misma idea: pipeline de transformaciones sobre respuesta HTTP. |
| Polly retry | NEXA no usa Polly (es C#). Implementamos retry custom en `HttpClient.request()` con backoff exponencial. |
| `loggerId+username` rewrite | Implementado en `EtecsaConnector.logout()` antes de construir el body. |
| `remove=1` enforcement | Hardcodeado en `LogoutRequest` builder. No se puede omitir. |

### 1.2 De `suitetecsa/suitetecsa-sdk-python` (referencia técnica primaria)

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| Arquitectura DI (abstract `NautaSession` + `NautaScrapper`) | NEXA divide en `IEtecsaConnector` + `HtmlParser` + `HttpClient` (3 interfaces). |
| Taxonomía de excepciones (`PortalLoginError`, etc.) | Convertida a `EtecsaError` discriminated union por `code`. |
| HTML fixtures en `tests/assets/` | NEXA adopta el mismo patrón en `tests/fixtures/etecsa-html/`. |
| `BeautifulSoup4` + `html5lib` | En NEXA: `DOMParser` nativo (suficiente para browser context). |
| Dual portal (`Portal.CONNECT` + `Portal.USER`) | NEXA solo implementa `CONNECT` en Fase 1. `USER` queda documentado para futura Fase. |

### 1.3 De `chenryhabana205/qvacall-cli` (referencia JavaScript)

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| `getLoginParameters()` — harvest all form inputs | Implementado en `DiscoveredEndpointStrategy`. Captura todos los `<input>` del form sin asumir nombres. |
| Regex unicode `/<script type="text\/javascript">\s*alert("([\w ().\p{L}]+)");/u` | Adoptada literalmente en `HtmlParser.extractAlertMessage()`. |
| Estrategia "no asumas nombres de campos" | Documentada como principio rector en el Doc 2. |

### 1.4 De `jorgeajimenezl/nauta-connect-gnome-extension`

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| `online.do` redirect detection | Implementado como señal secundaria en `KnownEndpointStrategy` — si la respuesta final es redirect a `online.do`, login fue exitoso incluso sin `ATTRIBUTE_UUID` visible. |
| `libsecret` (OS keyring) | En NEXA: `chrome.storage.session` + PBKDF2-derived key (D04). Concepto equivalente. |
| Single-file `NautaSession` class | NEXA divide en más archivos para testing y claridad, pero la idea de "una clase central que orquesta todo el flujo" se mantiene en `EtecsaConnector`. |

### 1.5 De `C-1412/control_center_etecsa`

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| Verify-credentials-without-login | Implementado como `IEtecsaConnector.verifyCredentials()` usando modo 2 de `EtecsaQueryServlet`. |
| Retry loop | Adaptado al `HttpClient` wrapper con backoff. |
| Full 3-step pre-login (probe → GET / → POST LoginServlet) | Adoptado como flujo canónico obligatorio en NEXA. |

### 1.6 De `stickm4n/stickNAUTA`

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| `acquire_user_info` pre-login | Implementado en `KnownEndpointStrategy.fetchLoginForm()`. Sin esto, CSRFHW puede estar expirado. |
| Context manager para sesión | En NEXA: el `SessionManager` gestiona el lifecycle. No es literalmente un `try-with`, pero conceptualmente igual. |
| Cached time-left TTL (evitar queries innecesarias) | NEXA cachea `timeRemaining` por 30s en `chrome.storage.session`. |
| Dos probes de conectividad | NEXA adopta `generate_204` + captive portal detection. |

### 1.7 De `mamei-tech/cnauta`

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| Enum `PLoginResult` | Convertido a `EtecsaErrorCode` discriminated union. |
| Catálogo de 5 errores canónicos | Extendido a 13 códigos en NEXA. |

### 1.8 De `luiscib3r/todo`

| Elemento | Cómo se adapta a NEXA |
|----------|----------------------|
| `Result<T>` pattern | Adoptado como `Result<T, EtecsaError>` en todo el connector layer. |
| Modelo `NautaSession` con `loginAction` + `ssid` | Inspiración para `SessionData`. NEXA no incluye `ssid` (no aplica en portal cautivo web). |

---

## 2. Qué Evitar (catálogo de antipatrones)

### 2.1 Antipatrones de seguridad (críticos)

| # | Antipatrón | Origen | Mitigación NEXA |
|---|------------|--------|-----------------|
| A1 | Credenciales en texto plano (pickle/JSON/INI) | Wachu985, pywifietecsa, econnect, nauta-connect-apk | AES-GCM con llave PBKDF2 derivada de master password (D04). |
| A2 | `chrome.storage.sync` para credenciales | nauta-connect (planned) | **Prohibido**. Usar `chrome.storage.local` + `chrome.storage.session` para llave. |
| A3 | `localStorage` para credenciales | stickNAUTA (web), EtecsaNauta PWA | **Prohibido**. `localStorage` es sincrónico y accesible por content scripts. |
| A4 | Logging de contraseña | stickNAUTA (debug) | Logger sanitizador con regex de patrones sensibles. |
| A5 | CSRFHW en URL query (GET logout) | Varios repos antiguos | Logout siempre con POST. Tokens en body, no en URL. |
| A6 | AES con llave hardcoded | Ninguno (pero común en scripts amateur) | Llave derivada PBKDF2 con sal aleatoria por instalación. |
| A7 | JWT secret en código | EtecsaNauta PWA | NEXA no maneja JWT en Fase 1. |

### 2.2 Antipatrones de arquitectura

| # | Antipatrón | Origen | Mitigación NEXA |
|---|------------|--------|-----------------|
| B1 | `setInterval` en service worker | nauta-connect MV2 | `chrome.alarms` (mínimo 1 min en producción). |
| B2 | Skip CMCCWLANFORM (pre-login step) | mmaciass, Wachu985 | Flujo canónico obliga GET / antes de POST LoginServlet. |
| B3 | Throw en connector layer | Casi todos | `Result<T, EtecsaError>` — sin throws. |
| B4 | Mixing UI + scraping + persistencia | La mayoría | Estricta separación UI → Services → Connector → HTTP. |
| B5 | Hardcoded `[13:-12]` slices | nauta-connect | Regex con named groups + tolerancia. |
| B6 | `cheerio` en browser context | nauta-connect | `DOMParser` nativo. |
| B7 | `share_session` TCP server local | stickNAUTA | No hay necesidad. La extensión vive en un solo SW. |
| B8 | Switch-statement fallthrough | nauta-connect-apk | ESLint con `no-fallthrough` rule. |
| B9 | Double-login call (login dos veces seguidas) | nauta-connect-apk | Operaciones idempotentes — verificar estado antes de actuar. |
| B10 | `react-chrome-redux` | nauta-connect MV2 | Zustand + `chrome.storage.onChanged` para sincronización SW-UI. |

### 2.3 Antipatrones de UX

| # | Antipatrón | Origen | Mitigación NEXA |
|---|------------|--------|-----------------|
| C1 | `chrome.notifications` nativas | Casi todos | Toast system NEXA custom (D10). |
| C2 | Emojis en UI | Varios | Iconos SVG + `lucide-react`. |
| C3 | Mensajes técnicos en inglés | Todos los repos | Toda UI en español (regla NEXA). |
| C4 | Errores sin acción recomendada | Todos los repos | `EtecsaError.recommendedAction` siempre populado. |
| C5 | Mostrar contraseña al editar cuenta | Varios | Solo botón "Regenerar contraseña" — nunca mostrar valor desencriptado. |
| C6 | Fórmula saldo→tiempo incorrecta (`*6`) | pywifietecsa | NEXA consulta `getLeftTime` directamente a ETECSA; no calcula. |

### 2.4 Antipatrones de testing

| # | Antipatrón | Origen | Mitigación NEXA |
|---|------------|--------|-----------------|
| D1 | Sin tests | La mayoría de repos | Vitest + fixture corpus (Fase 8). |
| D2 | Tests acoplados a red real | Varios | `MockEtecsaConnector` para todos los tests unitarios. |
| D3 | Sin fixtures HTML | La mayoría | Corpus en `tests/fixtures/etecsa-html/` con muestras reales. |
| D4 | Bare `except` clauses (Python) o `catch (e) {}` (JS) | Varios | ESLint `no-empty-catch`. Errores siempre tipados. |

---

## 3. Dependencias Técnicas (recomendadas)

### 3.1 Dependencias de producción

| Paquete | Versión | Justificación |
|---------|---------|---------------|
| `react` | ^18.3 | UI. No usar 19 hasta que shadcn/ui lo soporte plenamente. |
| `react-dom` | ^18.3 | Companion de React. |
| `zustand` | ^4.5 | State management (regla NEXA). |
| `tailwindcss` | ^3.4 | Estilos (regla NEXA). En Fase 3 evaluamos Tailwind 4 si estable. |
| `lucide-react` | ^0.400 | Iconos SVG consistentes (regla NEXA). |
| `class-variance-authority` | ^0.7 | Variantes tipadas para componentes (shadcn/ui pattern). |
| `clsx` | ^2.1 | Utilidad condicional de clases (shadcn/ui pattern). |
| `tailwind-merge` | ^2.4 | Merge inteligente de clases Tailwind. |
| `@radix-ui/react-*` | (varios) | Accesibilidad para shadcn/ui (Dialog, Select, etc.). |
| `zod` | ^3.23 | Validación runtime de inputs (formularios, importación JSON). |

### 3.2 Dependencias de desarrollo

| Paquete | Versión | Justificación |
|---------|---------|---------------|
| `typescript` | ^5.5 | Strict mode (regla NEXA). |
| `vite` | ^5.3 | Build system. |
| `@crxjs/vite-plugin` | ^2.0.0-beta | Plugin MV3 para Vite. HMR para popup/sidepanel. |
| `vitest` | ^1.6 | Testing framework. |
| `@testing-library/react` | ^16 | Tests de componentes. |
| `@vitest/coverage-v8` | ^1.6 | Coverage. |
| `eslint` | ^9 | Linting. |
| `@typescript-eslint/parser` + `plugin` | ^7 | Reglas TS. |
| `eslint-plugin-react-hooks` | ^4.3 | Reglas hooks. |
| `prettier` | ^3.3 | Formato. |
| `prettier-plugin-tailwindcss` | ^0.6 | Orden de clases Tailwind. |

### 3.3 Dependencias prohibidas

| Paquete | Razón |
|---------|-------|
| `axios` | Innecesario en MV3 — `fetch` con wrapper es suficiente. |
| `cheerio` | Bundle bloat — `DOMParser` nativo. |
| `jsdom` | No funciona en SW. |
| `lodash` | Tree-shaking problemático. Usar utilidades nativas. |
| `moment` | Usar `Intl.DateTimeFormat` o `date-fns` si necesario. |
| `react-chrome-redux` | Deprecado. Zustand + storage events es mejor. |
| `webextension-polyfill` | Innecesario si solo soportamos Chromium (no Firefox). |
| Cualquier lib de notificaciones | NEXA custom (D10). |

---

## 4. Orden Recomendado de Implementación

### 4.1 Secuencia entre fases (alto nivel)

```
Fase 2 (Arquitectura) ──► Fase 3 (Design System) ──► Fase 4 (Data Model)
                                                              │
                                                              ▼
Fase 6 (Connector) ◄──────────────────────────────────── Fase 5 (Núcleo)
        │                                                       ▲
        │                                                       │
        ▼                                                       │
Fase 7 (UI completa) ──────────────────────────────────────────┘
        │
        ▼
Fase 8 (Testing + Security) ──► Fase 9 (Release)
```

### 4.2 Secuencia dentro de cada fase (detalle crítico)

#### Fase 2 (Arquitectura Técnica) — orden recomendado:

1. Definir **estructura de carpetas** final (merge del Doc 2 de Fase 1 con la estructura propuesta en la Fase 2 del prompt).
2. Definir **message bus** entre SW y UI (tipos de mensajes, payload shapes).
3. Definir **event system** interno (eventos del connector al DiagnosticEngine).
4. Definir **storage namespaces** (`nexa.accounts`, `nexa.sessions`, `nexa.settings`, etc.).
5. Definir **state management** (Zustand stores + sincronización con storage).
6. Definir **security architecture** (master password flow, key derivation, AES-GCM).
7. Definir **theme architecture** (4 temas, CSS variables, ThemeProvider).
8. Definir **offline architecture** (estados ONLINE/OFFLINE/CONNECTING/AUTHENTICATED/SESSION_EXPIRED/ERROR).

#### Fase 5 (Núcleo) — orden recomendado:

1. Setup Vite + React + TS + Tailwind + @crxjs.
2. Manifest V3 base.
3. Service Worker skeleton + message bus.
4. Storage engine + repositories (skeleton, sin implementación real).
5. Zustand stores (skeleton).
6. ThemeProvider con 4 temas.
7. Font system (Syne, DNSans, JetBrainsMono autohospedadas).
8. Icon system (lucide-react).
9. Popup skeleton (estados logged out / logged in).
10. SidePanel skeleton con navegación.
11. Developer Mode skeleton (logs básicos).
12. LoggerService con sanitización.

#### Fase 6 (Connector) — orden recomendado:

1. Tipos y contratos (Doc 2 de Fase 1 → código).
2. `HttpClient` wrapper sobre `fetch`.
3. `HtmlParser` con `DOMParser`.
4. `errorCatalog.ts` con catálogo de mensajes español.
5. Strategy chain (5 strategies en orden: KnownEndpoint → DiscoveredEndpoint → ScrapingDom → ScrapingRegex → ManualFallback).
6. `EtecsaConnector` facade que orquesta.
7. `MockEtecsaConnector` para tests.
8. Fixture corpus HTML.
9. Tests unitarios por strategy.
10. HealthReporter integration con DiagnosticEngine.
11. Integración con `SessionManager` (que viene de Fase 5).
12. End-to-end smoke test (manual, en Chrome dev mode).

### 4.3 Riesgos por orden incorrecto

| Si hacemos X antes de Y | Consecuencia |
|-------------------------|--------------| 
| Implementar Connector antes que HttpClient | Acoplamiento; refactor doloroso |
| Implementar UI antes que Message Bus | Comunicación ad-hoc; reescritura |
| Implementar ThemeProvider antes que Design Tokens | Temas inconsistentes; retrabajo |
| Implementar strategies sin fixtures | Tests no reproducibles; falsos verdes |
| Implementar Master Password antes que Storage Engine | Sin donde guardar llave derivada |
| Implementar Toasts antes que NotificationEngine | Toasts acoplados a UI; eventos perdidos |

---

## 5. Riesgos de Implementación (aviso anticipado)

### 5.1 Riesgos técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| IR1 | `@crxjs/vite-plugin` beta inestable | Media | Alto | Pin a versión beta específica; fork local si rompe. |
| IR2 | `chrome.storage.session` límite 10MB | Baja | Medio | Monitorear uso; rotar logs. |
| IR3 | Service Worker termina durante login | Alta | Alto | Operaciones idempotentes; persistir estado intermedio en storage.local. |
| IR4 | `fetch` con `credentials: 'include'` no envía cookies ETECSA | Media | Alto | Verificar `host_permissions` en manifest; probar con `chrome.cookies` API como fallback. |
| IR5 | `DOMParser` no funciona en SW | Alta | Crítico | Ejecutar parsing en SW solo si está disponible; si no, delegar a offscreen document (Chrome 109+). |
| IR6 | ETECSA bloquea User-Agent de extensiones | Baja | Alto | Usar User-Agent de Chrome estándar; no identificar como extensión. |
| IR7 | ETECSA rate-limita IP tras N intentos | Alta | Medio | Backoff exponencial; cooldown configurable por cuenta (D03). |
| IR8 | `chrome.alarms` no ejecuta en segundo plano en algunos SO | Baja | Alto | Combinar con `chrome.runtime.onStartup` y `chrome.tabs.onUpdated` para reactivar. |
| IR9 | Tailwind 4 breaking changes | Media | Medio | Quedar en Tailwind 3.4 hasta Fase 9. |
| IR10 | Web Store rechaza por `host_permissions` amplios | Media | Alto | Solicitar solo `https://secure.etecsa.net:8443/*` y `https://www.nauta.cu/*`. Justificar en privacy.md. |

### 5.2 Riesgos de producto

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| PR1 | ETECSA introduce CAPTCHA en portal cautivo | Baja | Crítico | Detectar y degradar a login asistido en UI. |
| PR2 | ETECSA cambia URLs (migración de portal) | Media | Crítico | Strategy chain + DiscoveredEndpointStrategy cubre este caso. |
| PR3 | Web Store policy change prohíbe scraping | Baja | Crítico | Documentar en privacy.md que es automatización de flujo de usuario, no scraping de datos públicos. |
| PR4 | Conflicto de cookies con sesión ETECSA del usuario | Media | Medio | Documentar en User Guide: cerrar sesión ETECSA manual antes de usar NEXA NautaX. |
| PR5 | Usuario espera auto-reconnect que no funciona | Media | Medio | UX clara: mostrar cuando auto-reconnect está intentando y cuándo ha fallado. |

---

## 6. Definición de "Fase 1 Cerrada"

La Fase 1 se considera cerrada cuando:

- [x] Los 15 repositorios han sido investigados y documentados en 3 batches.
- [x] El Documento 1 (Research Report) está completo con endpoints, flujos y riesgos.
- [x] El Documento 2 (Architecture Proposal) define interfaces, strategies y mapeo a D01-D10.
- [x] El Documento 3 (Implementation Recommendations) define reutilización, antipatrones y orden de implementación.
- [ ] **Usuario valida los 3 documentos** y autoriza el cierre de Fase 1.
- [ ] Arquitecto actualiza el worklog con el cierre formal.

### Pendiente validación del usuario

Antes de pasar a Fase 2, necesito confirmación explícita de:

1. ¿Está de acuerdo con las decisiones técnicas F1-D1 a F1-D12 del Documento 1 §9?
2. ¿Está de acuerdo con la arquitectura de 5 strategies del Documento 2 §3?
3. ¿Está de acuerdo con la lista de dependencias del Documento 3 §3 (especialmente `@crxjs/vite-plugin` beta y prohibición de `axios`/`cheerio`/`jsdom`)?
4. ¿Está de acuerdo con el orden de implementación propuesto en §4?

Si alguna decisión no le convence, este es el momento de ajustarla. Una vez cerrada la Fase 1, los documentos son vinculantes para las Fases 2-6.

---

## 7. Entregables de Fase 1 (resumen)

| Archivo | Tamaño aprox. | Contenido |
|---------|---------------|-----------|
| `research-batch-1.md` | ~80 KB | Investigación detallada de repos 1-5 |
| `research-batch-2.md` | ~75 KB | Investigación detallada de repos 6-10 |
| `research-batch-3.md` | ~85 KB | Investigación detallada de repos 11-15 |
| `01-etecsa-connector-research-report.md` | ~25 KB | Síntesis ejecutiva con endpoints, flujos, riesgos |
| `02-nexa-connector-architecture-proposal.md` | ~20 KB | Arquitectura del Connector Layer |
| `03-implementation-recommendations.md` | este doc | Recomendaciones prácticas para Fases 2-6 |

Ubicación: `/home/z/my-project/download/phase-1/`

---

**Fin del Documento 3.**
**Fin de la Fase 1.**

Esperando validación del usuario para iniciar Fase 2 (Arquitectura Técnica Completa).
