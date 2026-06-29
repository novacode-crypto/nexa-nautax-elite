# NEXA NautaX — Phase 1 Research · Batch 3 of 3

**Project**: NEXA NautaX (Chromium extension for ETECSA Nauta accounts)
**Task ID**: 1-C
**Batch scope**: Repositories 11–15 of the 15-repo Phase 1 research sweep
**Date**: Phase 1, Batch 3
**Source of truth for decisions**: `/home/z/my-project/worklog.md` (D01–D10)

This document is a **technical** research report. It deliberately avoids marketing copy and
focuses on URLs, parameters, headers, parsing strategies, and security patterns that
will inform the NEXA NautaX connector layer (Phase 6).

> **Reading order note.** Repos #11, #12 and #14 implement the *full* login → query → logout
> flow against `secure.etecsa.net:8443` and are the most directly applicable to NEXA NautaX.
> Repo #13 is an Android port of the same flow with bugs worth documenting.
> Repo #15 is a Flutter app that, despite the misleading "todo" name, is ETECSA-related
> but only implements account storage and USSD catalog — *not* the actual portal flow.

---

## Repository 11 — `RaynerCadrelo/pywifietecsa`

- URL: https://github.com/RaynerCadrelo/pywifietecsa
- Branch inspected: `master`
- Files inspected: `README.md`, `wifietecsa.py`, `raywifietecsa.py`, `raywifietecsaclass.py`,
  `usuarios.py`, `refresh_version.py`, `__about__.py`, `config.ini`

### 1. Technology
- **Language / runtime**: Python 3
- **GUI stack**: GTK 3 via PyGObject (`python3-gi`), Glade UI files (`.glade`)
- **HTTP**: `requests`
- **HTML parsing**: `lxml.html` (XPath)
- **Config**: `configparser` (INI file at `config.ini`, plus a hidden `.datalogin` file)
- **Threading**: `threading.Thread` for non-blocking UI calls
- **Architecture**: Single class `RayWifiEtecsa` (`raywifietecsaclass.py`) acts as the connector.
  `wifietecsa.py` / `raywifietecsa.py` are the GTK entry points; `usuarios.py` is the multi-account
  management window.
- **Reusable elements for a Chromium extension (TS/React)**:
  - The complete endpoint map (see §3).
  - The pattern of "GET login page → scrape hidden inputs → POST form" maps cleanly to a
    `fetch()`-based connector.
  - The error-string catalogue (literal `count()` checks) is a useful seed for NEXA's
    connector error taxonomy — but must be rewritten with regex, not `in` checks.

### 2. Authentication Flow

ETECSA Wi-Fi portal (Nauta accounts) — `secure.etecsa.net:8443`:

1. **Pre-login (CSRF / hidden input fetch)** — `GET https://secure.etecsa.net:8443/`
   - Headers: `User-Agent: Mozilla/5.0 (X11; Linux x86_64)` (some calls use a "Mozilla/40.0"
     variant — looks accidental).
   - Cookies returned by server: tracked automatically by `requests` (a `JSESSIONID` cookie is
     implied by the use of `cookies=x1.cookies` on the next call).
   - The response is parsed with `lxml.html.fromstring(body)` and the login form is selected via
     the XPath `/html/body/div/div/div/div/form` (note: **NOT** by id `formulario`, unlike repos
     #12 and #14 — this is fragile).
   - All `<input>` elements of the form are collected; their `name`/`value` pairs become the
     initial POST body. Hidden inputs include `CSRFHW`, `wlanuserip`, `loggerId`, etc.

2. **Login POST** — `POST https://secure.etecsa.net:8443/EtecsaQueryServlet`
   - Note: the project posts to `form.action` (which is the form's `action` attribute), not a
     hardcoded URL. In practice this resolves to `/LoginServlet` (confirmed by repos #12/#14).
   - Headers: `content-type: application/x-www-form-urlencoded`
   - Body: form-encoded, all hidden inputs from step 1 + `username` + `password`
   - Cookies: must reuse cookies from the GET (the project passes `cookies=x1.cookies` for the
     "saldo" call but forgets to pass them on the `login()` call — likely works because the same
     `requests.Session` is *not* used; this is a latent bug).
   - Success detection: HTTP 200 AND response body contains the string `"Usted está conectado"`.
   - Error detection (string `count()` checks):
     - `"Usted ha realizado muchos intentos"` → too many attempts
     - `"El saldo de su cuenta es insuficiente"` or `"Su tarjeta no tiene saldo disponible"` → no balance
     - `"No se pudo autorizar al usuario"` → cannot authorize user
   - **Session token extraction**:
     ```python
     body2 = body.split("ATTRIBUTE_UUID")[1].split("&remove=")[0]
             .replace("+","").replace(" ","").replace("\r\n","").replace('"',"")
     urlParam = "ATTRIBUTE_UUID" + body2 + "&remove=1"
     ```
     The result (`urlParam`) is persisted to `.datalogin` (INI file under `[DATA_LOGIN]` → `DATA`)
     and reused as the request body for `time()` and `logout()`.
   - **Key insight**: This repo stores the *entire URL-encoded string* `ATTRIBUTE_UUID=…&remove=1`
     rather than just the UUID value. Slightly unusual but functional.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|--------------------|---------------------|
| `https://secure.etecsa.net:8443/` | GET | Fetch login form + CSRF (`CSRFHW`) + `wlanuserip` + `loggerId` hidden inputs | none | HTML 200 with `<form>` containing hidden inputs | **Login pre-step** (mandatory) |
| `https://secure.etecsa.net:8443/LoginServlet` (via `form.action`) | POST (form-encoded) | Wi-Fi portal login | `CSRFHW`, `wlanuserip`, `loggerId`, `username`, `password`, (other hidden inputs) | HTML 200; on success contains `ATTRIBUTE_UUID=…&remove=…` and `online.do` redirect; on failure contains `alert("…")` with reason | **Login** |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Account balance / status query | `username`, `password`, `CSRFHW`, `wlanuserip` | HTML 200 with `table#sessioninfo` containing balance in `tbody/tr[2]/td[2]` | **Balance query** — but see §5, this *logs the user in* if not already connected, so should NOT be used from NEXA just for balance |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Remaining time | `op=getLeftTime`, `ATTRIBUTE_UUID=…&remove=1` (the URL-param blob) | Plain-text body `HH:MM:SS` | **Remaining time** (active session) |
| `https://secure.etecsa.net:8443//LogoutServlet` | POST (form-encoded) | Logout | `ATTRIBUTE_UUID=…&remove=1` (note the **double slash** typo `//LogoutServlet` in the source — server tolerates it) | Body `logoutcallback('SUCCESS');` on success | **Logout** |
| `https://www.portal.nauta.cu/user/login/es-es` | GET + POST | Nauta user portal login (separate from Wi-Fi portal; has CAPTCHA) | `login_user`, `password_user`, `csrf_token` (hidden), `btn_submit`, `captcha` | HTML 200 with `div.z-depth-1.card-panel` containing balance | **Out of scope for Fase 1** (D09 = prepaid only, no portal scraping required) |
| `https://www.portal.nauta.cu/captcha/?<timestamp>` | GET | CAPTCHA image fetch for portal login | none (cookies required) | PNG image | Out of scope (D01: no CAPTCHA) |
| `https://www.portal.nauta.cu/useraaa/transfer_balance` | GET + POST | Transfer balance to another Nauta account | `id_cuenta`, `password_user`, `transfer`, `action=checkdata` + hidden form fields | HTML with `msg_error` or `msg_message` div | Out of scope for Fase 1 |
| `https://www.portal.nauta.cu/useraaa/recharge_account` | GET + POST | Recharge account with coupon code | `recharge_code`, `btn_submit` + hidden form fields | HTML with `msg_error` or `msg_message` div | Out of scope for Fase 1 |
| `http://www.cubadebate.cu/` | GET | Connectivity probe (the repo checks if the body contains "Cubadebate") | none | HTML 200 | **Pattern reference only** — NEXA should probe `secure.etecsa.net:8443` directly or use `chrome.alarms` + a captive-portal check |

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443//LogoutServlet` (double slash is in the source).
- Headers: `content-type: application/x-www-form-urlencoded`.
- Body: the persisted `urlParam` string, i.e. `ATTRIBUTE_UUID=<uuid>&remove=1`.
- **No prior session info needed beyond `ATTRIBUTE_UUID`** — note that this repo does *not* send
  `JSESSIONID` cookie or `CSRFHW`/`wlanuserip` on logout. This contradicts repos #12 and #14,
  which send the full session data. In practice, ETECSA's `LogoutServlet` seems to accept just
  the UUID + `remove=1` — but other repos' approach is more robust.
- Success detection: response body contains `"SUCCESS"` (the actual response is the JSONP-style
  string `logoutcallback('SUCCESS');`).

### 5. Balance / time / session info
- **Balance (CUP)** — the `saldo()` method:
  1. POST to `EtecsaQueryServlet` with `username` + `password` + the hidden form inputs
     (note: this is essentially a *login* call, and **will start a new session** if the user
     isn't already connected — pywifietecsa misuses this for "balance check" and it works
     because ETECSA returns the `table#sessioninfo` page on a fresh login).
  2. Parse the response with XPath:
     `//table[@id="sessioninfo"]/tbody/tr[2]/td[2]/text()`
     → returns e.g. `"0.10 CUP\n"`; whitespace is stripped.
  3. The repo then derives an *estimated remaining time* from the balance using a hardcoded
     formula:
     - International accounts (`@nauta.com.cu`): rate = 175 centavos/hour →
       `segundos = saldo_centavos * 6 / 175` (the `*6` factor is suspicious — likely a leftover
       from an older rate calculation; **do NOT copy this formula**).
     - National accounts (`@nauta.co.cu`): rate = 25 centavos/hour → same `*6` factor.
- **Remaining time (live session)** — the `time()` method:
  - POST to `EtecsaQueryServlet` with body `op=getLeftTime&ATTRIBUTE_UUID=…&remove=1`.
  - Response is plain text `HH:MM:SS`.
- **Connection start time**: not parsed from server; the GNOME extension (#12) and
  `Nothing.Nauta` (#14) record `DateTime.Now` locally when login succeeds.
- **Account expiration date**: not queried. ETECSA's Wi-Fi portal does not surface this; the
  Nauta user portal (`portal.nauta.cu`) would, but that requires CAPTCHA (D01 → out of scope).
- **HTML scraping vs structured API**: HTML scraping for balance; plain-text response for time.

### 6. Scraping analysis
- **Login form**: `/html/body/div/div/div/div/form` — **fragile positional XPath**. If ETECSA
  adds a wrapper `<div>` or reorders the layout, this breaks. **High risk.**
- **Balance table**: `//table[@id="sessioninfo"]/tbody/tr[2]/td[2]/text()` — ID-based selection
  is more robust than the form XPath, but the row/column index is positional. **Medium risk.**
- **ATTRIBUTE_UUID extraction**: `body.split("ATTRIBUTE_UUID")[1].split("&remove=")[0]` —
  string-splitting, not regex. Works because ETECSA emits a JS snippet of the form
  `ATTRIBUTE_UUID=<value>&remove=1`. **Medium risk** (depends on the literal string
  `ATTRIBUTE_UUID` and `&remove=` being present in the response).
- **Portal balance** (when used): `//div[@class="z-depth-1 card-panel"]/div/div/div[5]/div/p` —
  very positional, **high risk**, only used for the portal.nauta.cu flow.
- **Error message parsing**: literal `body.count("Usted ha realizado muchos intentos")` etc.
  Case- and punctuation-sensitive. **Medium-high risk.**
- **What happens if ETECSA changes HTML**: the login flow would break first (XPath is brittle).
  Time and logout would still work because they don't parse HTML — only the UUID extraction
  would need updating.

### 7. Security review
- **Credential storage**: `config.ini` (INI file, plain text, world-readable in the repo):
  ```
  [USERS]
  user0 = pepito37@nauta.com.cu
  pass0 = 123456
  ```
  - The `config.ini` file is shipped in the repo with **real-looking demo credentials**. This is
    a critical anti-pattern.
- **Encryption**: none. Passwords are stored as plain text on disk.
- **Session token storage**: `.datalogin` (INI file) stores `ATTRIBUTE_UUID=…&remove=1` in
  plain text. Survives reboots; would allow anyone with file access to disconnect the user.
- **Logging**: prints balance to stdout (`print(dinero_str)` in `saldo()`). Not credential
  logging per se, but leaks balance to terminal/logs.
- **User-Agent**: hardcodes `Mozilla/5.0 (X11; Linux x86_64)` and (in `saldo()`) a clearly
  fake `Mozilla/40.0` — the latter may be flagged by ETECSA's WAF in stricter deployments.
- **What NOT to copy**:
  - Plain-text credential storage.
  - Shipping credentials in the repo.
  - Hardcoded balance-to-time formula (the `*6` magic number is wrong).
  - Positional XPath for form discovery.
  - String `.count()` for error detection (use regex + a curated error catalogue).
- **Best practices to inherit**:
  - The endpoint map (the actual URLs and the `op=getLeftTime` parameter).
  - The "scrape hidden inputs from the login form" pattern.
  - The `ATTRIBUTE_UUID` extraction logic (rewritten as a proper regex).
  - The "literal `SUCCESS` / `logoutcallback('SUCCESS');`" success signal for logout.

### 8. Known issues / limitations
- The `saldo()` method *re-logs in* the user every time it is called — this is wasteful and
  creates dangling sessions if the user is already connected. NEXA NautaX must NOT replicate
  this; balance should be queried only from a live session via `EtecsaQueryServlet` with
  `ATTRIBUTE_UUID`, not via a fresh login.
- The `.datalogin` file is read with `configparser` but written with the same `configparser`
  object retained in `self._configDataLogin` across calls — there are race conditions if the
  UI fires multiple login/logout actions quickly.
- The README lists Python dependencies but no installation script beyond `apt install`-style
  hints. Windows binary release is provided.
- No CSRF token *refresh* mechanism: once the form's hidden inputs are fetched, they are not
  re-fetched on subsequent login attempts in the same process. If the CSRF expires (typically
  a few minutes), login silently fails with `"No se pudo autorizar al usuario"`.
- The captcha image for the Nauta portal flow is saved to disk (`imagenCaptcha.png`) — temp
  file is never explicitly removed.

---

## Repository 12 — `jorgeajimenezl/nauta-connect-gnome-extension`

- URL: https://github.com/jorgeajimenezl/nauta-connect-gnome-extension
- Branch inspected: `master`
- Files inspected: `README.md`, `src/nautaSession.js`, `src/extension.js`, `src/prefs.js`,
  `src/metadata.json`, `install.sh`

### 1. Technology
- **Language / runtime**: JavaScript (GJS — GNOME Shell's JS engine), ES modules
- **HTTP**: `libsoup` 3.0 via `gi://Soup?version=3.0`
- **HTML parsing**: `GXml` (`gi://GXml`) — specifically `GXml.XHtmlDocument.from_string(content, 32)`
  with `querySelector` / `querySelectorAll` (the `32` flag is `XHtmlDocument` parsing mode)
- **Secrets**: `libsecret` (`gi://Secret`) — credentials are stored in the GNOME keyring
- **Settings**: `Gio.Settings` with schema `org.gnome.shell.extensions.nauta-connect`
- **Architecture**: `NautaSession` class (`nautaSession.js`) is the connector (clean separation
  from the GNOME shell UI in `extension.js`). State is serialised to/from `GSettings`.
  `prefs.js` is the preferences window (account CRUD).
- **Reusable elements for a Chromium extension (TS/React)**:
  - **`NautaSession` is the closest architectural blueprint for NEXA's connector layer**:
    state object, async methods, clean separation of `build_session` / `login` / `logout` /
    `user_credits` / `remaining_time`.
  - The `state = { csrfhw, wlanuserip, login_url, auth }` shape is essentially what NEXA's
    `SessionData` branded type should look like.
  - The `is_connected` / `is_valid_session` getters are a good pattern for the connector's
    state machine.

### 2. Authentication Flow

ETECSA Wi-Fi portal — `secure.etecsa.net:8443`:

1. **Pre-login (CSRF fetch)** — `build_session()` method:
   ```
   GET https://secure.etecsa.net:8443/
   ```
   - A `Soup.Session` with a `Soup.CookieJar` feature is mandatory ("without this piece of shit
     doesn't works" — author's comment in source).
   - Response is parsed with `GXml.XHtmlDocument.from_string(content, 32)`.
   - Form is selected via `query_selector("#formulario")` — **ID-based**, much more robust than
     repo #11's positional XPath.
   - All `<input type="hidden">` inside the form are enumerated and stored in a map:
     `map[name.toLowerCase()] = value`.
   - Two values are extracted explicitly: `csrfhw` and `wlanuserip`.
   - The form's `action` attribute is stored as `state.login_url` (typically `/LoginServlet`).
   - Note: the `wlanuserip` and `csrfhw` keys are stored *lowercase* in `state` but sent as
     `CSRFHW` (uppercase) and `wlanuserip` (lowercase) in the request body — see `_send_request`.

2. **Login POST** — `login(username, password)` method:
   ```
   POST <state.login_url>   (typically https://secure.etecsa.net:8443/LoginServlet)
   Content-Type: application/x-www-form-urlencoded
   ```
   - Body (form-encoded via `Soup.form_encode_hash`):
     ```
     CSRFHW=<csrfhw>
     wlanuserip=<wlanuserip>
     username=<user>
     password=<pass>
     ```
   - **Success detection**: the response URI contains `online.do`. This is a redirect-based
     detection — the server responds with an HTTP 302 to a URL containing `online.do` on
     successful login. If the URI does *not* contain `online.do`, the response is parsed as
     HTML and the last `<script>` element is inspected for an `alert("…")` call; the alert
     text is thrown as the error message.
   - **Session token extraction**: `res.match("ATTRIBUTE_UUID=([^&]+)")` — a clean regex (unlike
     repo #11's split-based approach). The captured group becomes `state.auth = [username, uuid]`.
   - **Note on a bug**: the code has `if (m === 1)` instead of `if (m === null)` after the regex
     match — this is clearly a typo (it should check `m === null`). In practice the check is
     unreachable because `String.match` returns an array or `null`, never `1`. NEXA must use
     `if (m === null)` correctly.

3. **Subsequent requests** — `_send_request(base, path, form)` helper:
   - Builds `state_form = { CSRFHW, wlanuserip, ...form }`.
   - If the session is connected (`state.auth` is set), also injects `username` and
     `ATTRIBUTE_UUID` into the form. This is the canonical pattern for all post-login calls.
   - POSTs form-encoded to `${base}${path}`.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|--------------------|---------------------|
| `https://secure.etecsa.net:8443/` | GET | Fetch login form + CSRF + `wlanuserip` + form `action` | none | HTML with `#formulario` containing hidden inputs | **Login pre-step** |
| `https://secure.etecsa.net:8443/LoginServlet` (from form action) | POST (form-encoded) | Wi-Fi portal login | `CSRFHW`, `wlanuserip`, `username`, `password` | HTTP 302 to `online.do` on success; HTML with `alert("…")` on failure; body contains `ATTRIBUTE_UUID=<uuid>` | **Login** |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Account balance / credit query | `CSRFHW`, `wlanuserip`, `username`, `password`, `ATTRIBUTE_UUID` (when connected) | HTML with `#sessioninfo > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2)` containing the balance string | **Balance query** — note: this requires `username` + `password` even when the session is already authenticated, which is unusual; see §5 |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Remaining time | `CSRFHW`, `wlanuserip`, `username`, `ATTRIBUTE_UUID`, `op=getLeftTime` | Plain text `HH:MM:SS` | **Remaining time** (live session) |
| `https://secure.etecsa.net:8443/LogoutServlet` | POST (form-encoded) | Logout | `CSRFHW`, `wlanuserip`, `username`, `ATTRIBUTE_UUID` | HTML 200 (no specific success string parsed) | **Logout** |

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443/LogoutServlet`
- Body (form-encoded): `CSRFHW`, `wlanuserip`, `username`, `ATTRIBUTE_UUID` (all sent via the
  `_send_request` helper which always includes CSRFHW + wlanuserip +, if connected, username + UUID).
- **Requires prior session info**: yes — specifically `state.auth = [username, attribute_uuid]`
  and `state.csrfhw` / `state.wlanuserip`. So the full session data must be persisted between
  login and logout (the extension persists them in `GSettings`).
- Success/failure: the method `await`s the response and clears `state.auth = null` unconditionally
  on the client side; no server-side success string is checked. This is **less robust** than
  repo #11's `logoutcallback('SUCCESS')` check — NEXA should validate the server response.

### 5. Balance / time / session info
- **Balance (CUP)** — `user_credits(username, password)`:
  - POST to `EtecsaQueryServlet` with `username` + `password` + the session form fields.
  - Parse with `GXml.XHtmlDocument` and select:
    `#sessioninfo > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2)`
  - Returns the trimmed text content (e.g. `"0.10 CUP"`).
  - **Quirk**: unlike `remaining_time()`, this method requires `username` + `password` to be
    re-sent — even when the user is already connected. This suggests ETECSA's
    `EtecsaQueryServlet` supports two modes: (a) authenticated by UUID (for `op=getLeftTime`)
    and (b) authenticated by username/password (for the full session info table).
- **Remaining time** — `remaining_time()`:
  - POST to `EtecsaQueryServlet` with `op=getLeftTime` + session fields.
  - Response is plain text `HH:MM:SS`.
  - Parsed: `res.split(":").map(parseInt)` → returns total seconds
    `h*3600 + m*60 + s`. Throws if any component is `NaN`.
- **Connection start time**: recorded locally by `extension.js` via
  `GLib.get_monotonic_time()` when `setupTimer()` is called after login (not extracted from
  server).
- **Account expiration date**: not queried.
- **HTML scraping vs structured API**: HTML scraping for balance; plain text for time.

### 6. Scraping analysis
- **Login form**: `#formulario` — CSS ID selector via `querySelector`. **Low risk** (form is
  unlikely to lose its ID; even if ETECSA rewrites the page, the ID is the canonical handle).
- **Hidden inputs**: `input[type="hidden"]` inside `#formulario`. **Low risk.**
- **Balance cell**: `#sessioninfo > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(2)` —
  ID + positional. **Medium risk** (positional row/column).
- **Error message**: regex on the *last* `<script>` tag of the response:
  `alert\(\"([^\"]*?)\"\)`. **Medium risk** (assumes errors are emitted as `alert()` calls in
  the last script tag — true today but fragile).
- **ATTRIBUTE_UUID**: regex `ATTRIBUTE_UUID=([^&]+)` — **Low risk** (the UUID is emitted as a
  query-string-style fragment; the regex is canonical).
- **Success detection via `online.do` in the response URI**: **Low-medium risk** (depends on
  ETECSA's redirect target URL).

### 7. Security review
- **Credential storage**: `libsecret` (GNOME Keyring). Credentials are stored with the schema
  `org.jorgeajimenezl.nauta-connect.NetworkCredentials` and attributes `uuid` + `application`.
  The username is used as the secret *label*; the password is the *secret value*. This is the
  correct pattern for desktop apps and maps conceptually to NEXA's `chrome.storage.session`
  + master-password-encrypted `chrome.storage.local` model.
- **Encryption**: provided by the OS keyring (typically AES-256 in GNOME Keyring, locked by
  the user's login password). NEXA cannot use this directly (no OS keyring in MV3) but should
  inherit the principle: **passwords are never written to disk in plaintext**.
- **Session token storage**: `GSettings` (`org.gnome.shell.extensions.nauta-connect` schema)
  stores `session-csrfhw`, `session-wlanuserip`, `session-login-url`, `session-username`,
  `session-attribute-uuid`, `session-connected`. These are stored in dconf (essentially
  plain text on disk, readable by the user). **The UUID + wlanuserip + CSRFHW are sensitive**
  (sufficient to disconnect the user). NEXA should treat `SessionData` as sensitive and store
  it encrypted (master-password + PBKDF2 → AES, per D04).
- **Logging**: uses `console.log` / `console.warn` / `console.error` (visible in
  `journalctl`). No credential logging observed, but the username is logged on login attempt:
  `console.log(\`Trying to login with: ${username}\`)`. NEXA's D08 (local logs only) + the
  principle of not logging identifiers should be enforced.
- **What NOT to copy**:
  - Storing session tokens in `GSettings` (plain dconf). NEXA must encrypt them.
  - The `if (m === 1)` typo in the UUID check.
  - The unconditional `state.auth = null` on logout without verifying the server's response.
- **Best practices to inherit**:
  - **The `NautaSession` class structure** — this is the cleanest connector blueprint in the
    entire 15-repo research sweep. NEXA's `EtecsaConnector` should mirror its shape:
    `buildSession()`, `login(username, password)`, `logout()`, `userCredits()`,
    `remainingTime()`.
  - **The `#formulario` ID-based form discovery** — strictly better than positional XPath.
  - **The `online.do` redirect-based success detection** — more reliable than string matching
    on the body.
  - **The `op=getLeftTime` + UUID pattern** for time queries.
  - **The `libsecret` separation of concerns** — NEXA's equivalent is the master-password
    layer in D04.
  - **The use of a `CookieJar`** — NEXA must configure `fetch()` credentials correctly or
    manage cookies manually (the `JSESSIONID` cookie is set on the GET and required for login).

### 8. Known issues / limitations
- The `if (m === 1)` typo (see §2) — would throw a misleading "Invalid response (without
  connection identifier)" error if the regex matched but the result was `null`. In practice
  unreachable because `String.match` returns array or `null`, never `1`, but worth noting.
- The remaining-time UI timer uses `GLib.timeout_add_seconds` (1-second tick). NEXA's MV3
  equivalent is `chrome.alarms` (D10 + worklog critical constraints). The GNOME extension's
  approach of computing `totalTime - elapsed` from a local monotonic clock is a useful pattern
  for NEXA's countdown display (avoids hitting ETECSA every second).
- The extension does not handle CSRF token expiry: if the user takes more than a few minutes
  between opening the menu and clicking "login", the `build_session()`-fetched CSRF may have
  expired and login will fail with an alert. NEXA should fetch CSRF immediately before each
  login attempt (cheap GET).
- The GNOME shell version is pinned to `45` in `metadata.json` (`shell-version: ["45"]`).
- The `disconnect-vpn` option (deactivates all VPNs before logout) is GNOME-specific and not
  applicable to NEXA.

---

## Repository 13 — `roniel-rhack/nauta-connect-apk`

- URL: https://github.com/roniel-rhack/nauta-connect-apk
- Branch inspected: `master`
- Files inspected: `README.md`, `app/build.gradle`, `app/src/main/AndroidManifest.xml`,
  `app/src/main/java/com/example/nautaconnect/MainActivity.java`,
  `app/src/main/java/com/example/nautaconnect/DatosActivity.java`,
  `app/src/main/java/com/example/nautaconnect/Conectado.java`,
  `app/src/main/java/com/example/nautaconnect/User.java`

### 1. Technology
- **Language / platform**: Java, Android (minSdk 24, targetSdk 29 — older Android)
- **HTTP / HTML**: `Jsoup` 1.13.1 (HTTP client + HTML parser combined)
- **JSON serialisation**: `Gson` 2.8.6
- **UI**: AndroidX AppCompat, ConstraintLayout, Material components
- **Architecture**: Three activities:
  - `MainActivity` — login screen (also does the login HTTP call).
  - `DatosActivity` — dashboard showing balance, chronometer, disconnect button.
  - `Conectado` — informational screen shown if the device is already connected to Wi-Fi/mobile
    data on launch.
  - `User` — singleton holding all session state (`username`, `password`, `ATTRIBUTE_UUID`,
    `CSRFHW`, `leftTime`, `saldoCuenta`, `estadoCuenta`).
- **Reusable elements for a Chromium extension (TS/React)**:
  - The endpoint map (see §3) — largely consistent with repos #11/#12/#14, with the
    *additional* `wlanacname`, `wlanmac`, `ssid`, `usertype`, `gotopage`, `successpage`,
    `lang`, `firsturl`, `loggerId` parameters made explicit. NEXA should send the full set.
  - The Java switch-statement error catalogue (buggy but useful as a vocabulary).
  - **Otherwise this repo is mostly a cautionary tale** — see §7 and §8.

### 2. Authentication Flow

`MainActivity.sendConnect()`:

1. **Pre-login (CSRF fetch)** — `Jsoup.connect("https://secure.etecsa.net:8443").method(GET).execute()`
   - The `Connection.Response` object holds cookies (accessed via `execute.cookies()`).
   - HTML is parsed via `execute.parse()`.
   - CSRFHW is extracted via Jsoup CSS selector: `select("input[name=CSRFHW]").first().val()`.
   - Stored on the `User` singleton.

2. **Login POST (first attempt — to EtecsaQueryServlet, NOT LoginServlet)**:
   ```
   POST https://secure.etecsa.net:8443/EtecsaQueryServlet
   Cookies: <from step 1>
   Body (form-encoded):
     wlanacname=
     wlanmac=
     firsturl=notFound.jsp
     ssid=
     usertype=
     gotopage=/nauta_etecsa/LoginURL/mobile_login.jsp
     successpage=/nauta_etecsa/OnlineURL/mobile_index.jsp
     loggerId=<yyyyMMddHHmmssSSS>
     lang=es_ES
     username=<user>
     password=<pass>
     CSRFHW=<csrfhw>
   ```
   - **Important**: This call uses `Jsoup.connect(...).cookies(execute.cookies())` so cookies
     (including `JSESSIONID`) are forwarded.
   - `followRedirects(true)` is set.
   - The response is parsed as a `Document`. If the last `<script>` tag does *not* contain
     `alert("return null");`, the login is considered successful. The script selector extracts
     the saldo and account state:
     - `select("table#sessioninfo > tbody > tr > td").get(3).text()` → `saldoCuenta`
     - `select("table#sessioninfo > tbody > tr > td").get(1).text()` → `estadoCuenta`

3. **Login POST (second call — to LoginServlet)** — *immediately after step 2*:
   ```
   POST https://secure.etecsa.net:8443/LoginServlet
   Body (form-encoded):
     username=<user>
     password=<pass>
   ```
   - **Bizarre**: this call does NOT include `CSRFHW`, `wlanuserip`, `loggerId`, or any of the
     other hidden form fields. It also does NOT forward the cookies from step 1 (Jsoup creates
     a fresh connection). This is almost certainly **broken** in the current ETECSA portal —
     either it ever worked in an older portal version, or the actual login is achieved by
     step 2 (the `EtecsaQueryServlet` call) and step 3 is vestigial.
   - The response body is inspected for the same error strings as repo #11:
     - `"El nombre de usuario o contraseña son incorrectos"`
     - `"No se pudo autorizar al usuario"`
     - `"Usted a realizado muchos intentos"` (note the typo `a` instead of `ha` — this may
       actually match ETECSA's typo, worth verifying)
     - `"Su tarjeta no tiene saldo disponible"`
   - **Session token extraction**:
     ```java
     loggin.select("script").first().toString().split("ATTRIBUTE_UUID=")[1].split("&")[0]
     ```
     String-split based, similar to repo #11. Stored as `ATTRIBUTE_UUID` on the singleton.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|--------------------|---------------------|
| `https://secure.etecsa.net:8443/` | GET | Fetch login form + CSRFHW | none | HTML 200 with `input[name=CSRFHW]` | **Login pre-step** |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Login + balance + state query (mobile path) | `wlanacname`, `wlanmac`, `firsturl`, `ssid`, `usertype`, `gotopage`, `successpage`, `loggerId`, `lang`, `username`, `password`, `CSRFHW` | HTML 200 with `table#sessioninfo` (rows of `td`) and `ATTRIBUTE_UUID=…` in a `<script>` | **Login** (this is the actual login call in this implementation) |
| `https://secure.etecsa.net:8443/LoginServlet` | POST (form-encoded) | (Vestigial / broken second login call) | `username`, `password` only | HTML with error strings or `ATTRIBUTE_UUID=…&` in a `<script>` | **Do NOT copy** — see §8 |
| `https://secure.etecsa.net:8443//EtecsaQueryServlet` (note double slash, likely a typo) | POST (form-encoded) | Remaining time | `username`, `ATTRIBUTE_UUID`, `op=getLeftTime` | Plain text `HH:MM:SS` (extracted via `select("body").text()`) | **Remaining time** |
| `https://secure.etecsa.net:8443/LogoutServlet` | POST (form-encoded) | Logout | `username`, `ATTRIBUTE_UUID` | Body containing `'<value>'` (parsed via `body().toString().split("'")[1]` — expects `logoutcallback('SUCCESS');`) | **Logout** |

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443/LogoutServlet`
- Body (form-encoded): `username` + `ATTRIBUTE_UUID` only. **Does NOT include** `CSRFHW`,
  `wlanuserip`, `remove=1`, or `JSESSIONID` cookie.
- Success detection: `loggin.body().toString().split("'")[1]` — extracts the first
  single-quoted substring from the body, which corresponds to the `SUCCESS` / `FAILURE` token
  in `logoutcallback('SUCCESS');`. The extracted value is `System.out.println`-ed but never
  actually checked.
- **Requires prior session info**: only `ATTRIBUTE_UUID` (and `username`, which the user
  singleton retains). No CSRF re-fetch needed.

### 5. Balance / time / session info
- **Balance (CUP)** — extracted during the login flow (step 2 above) from
  `table#sessioninfo > tbody > tr > td` at index 3. Returned as a string (e.g. `"0.10 CUP"`).
  Displayed in `DatosActivity.saldo` TextView.
- **Account state** — extracted at the same time from index 1 of the same `td` list
  (`estadoCuenta`). The repo doesn't document what values this can take.
- **Remaining time** — `DatosActivity.sendLeftTime()`:
  - POST to `https://secure.etecsa.net:8443//EtecsaQueryServlet` (double slash typo)
    with `username`, `ATTRIBUTE_UUID`, `op=getLeftTime`.
  - Response parsed via `leftTimeDocument.select("body").text()` → returns `HH:MM:SS`.
  - A `CountDownTimer` is started locally based on this value; the chronometer is independent.
- **Connection start time**: recorded locally via `SystemClock.elapsedRealtime()` when
  `DatosActivity.onCreate` calls `simpleChronometer.setBase(...)`. Not from server.
- **Account expiration date**: not queried.

### 6. Scraping analysis
- **CSRFHW**: `input[name=CSRFHW]` — CSS attribute selector. **Low risk.**
- **Balance/state cells**: `table#sessioninfo > tbody > tr > td` with `.get(1)` and `.get(3)`
  — ID + positional index. **Medium-high risk** (any reordering of the table cells breaks it).
- **ATTRIBUTE_UUID**: `script` tag split on `ATTRIBUTE_UUID=` and `&`. **Medium risk** (depends
  on the literal `ATTRIBUTE_UUID=` substring being present in a script tag).
- **Error detection**: literal `body.toString().contains("…")` checks. **Medium risk.**
- **Time response**: `select("body").text()` — extracts the entire body text. **Low risk**
  (the response is plain text `HH:MM:SS`).

### 7. Security review
- **Credential storage**: plain JSON file `dataNautaConnect.dat` written to the app's
  internal storage (`Context.MODE_PRIVATE`) via `openFileOutput`. The file contains the full
  `User` object including `username`, `password`, `ATTRIBUTE_UUID`, `CSRFHW`, `saldoCuenta`,
  `estadoCuenta` — all in **plain text**. MODE_PRIVATE restricts access to the app's UID on
  Android, but the file is readable on rooted devices and via ADB backup.
- **Encryption**: none.
- **Logging**: `e.printStackTrace()` everywhere; `System.out.println(...)` on the logout
  response. No credential logging per se, but `printStackTrace` can leak stack traces that
  include URL parameters in some Jsoup versions.
- **User session singleton**: `User.getUser()` is a static singleton with no thread safety.
  Multi-account support is impossible with this design — relevant to NEXA's D02 (multi-account
  with one active at a time).
- **Manifest**: `INTERNET` and `ACCESS_NETWORK_STATE` permissions only — minimal, which is
  good. `android:allowBackup="true"` means the credentials file can be backed up via ADB
  (`adb backup`) — a known Android anti-pattern for sensitive data.
- **What NOT to copy**:
  - **Plain JSON credential file** — NEXA's D04 mandates master-password + PBKDF2 + AES.
  - **The double login call** (`EtecsaQueryServlet` then `LoginServlet`) — broken and wasteful.
  - **The missing `CSRFHW` / `wlanuserip` on logout** — works only because ETECSA's
    `LogoutServlet` is lenient; not robust.
  - **The `allowBackup="true"` manifest flag** (NEXA N/A, but principle: do not allow
    extension state to be backed up in plaintext).
  - **The `switch` statement with no `break`** in `MainActivity.sendConnect()` — every case
    falls through, so all error TextViews are set. Pure bug.
  - **Static singleton for session state** — incompatible with MV3 SW ephemeral lifecycle.
- **Best practices to inherit**:
  - The full explicit parameter set for the login POST (especially `gotopage`,
    `successpage`, `lang`, `loggerId` format `yyyyMMddHHmmssSSS`) — useful as a reference for
    what ETECSA's portal historically expects.
  - The mobile-specific paths `/nauta_etecsa/LoginURL/mobile_login.jsp` and
    `/nauta_etecsa/OnlineURL/mobile_index.jsp` — NEXA may want to emulate the mobile client
    instead of the desktop one for smaller response sizes (decision for Phase 6).
  - The `CountDownTimer` + local chronometer pattern for displaying remaining time without
    polling the server every second.

### 8. Known issues / limitations
- **The two-call login sequence is broken**. The first call to `EtecsaQueryServlet` with
  username/password + CSRFHW actually performs the login (this is consistent with repo #11's
  `saldo()` behaviour). The second call to `LoginServlet` without CSRFHW probably always
  fails or returns an error page that is then ignored. The repo "works" only because the
  ATTRIBUTE_UUID is extracted from the *second* call's `<script>` tag — but if the second
  call fails, the UUID would be from the first call's response (which the code does *not*
  parse). This is a latent bug.
- **Switch statement fall-through** in `MainActivity.sendConnect()` (no `break;` between
  cases) — every error case sets the same TextView to `R.string.user_passw_error`. Cosmetic
  bug.
- **`User` singleton** prevents multi-account support entirely.
- **`allowBackup="true"`** — credentials can be exfiltrated via ADB.
- **Hardcoded strings**: `"prp"` as the default username sentinel in the `User` constructor is
  arbitrary and unexplained.
- The repo hasn't seen commits in years (compileSdkVersion 29 / 2020-era dependencies).
- The README is two lines; no documentation of the actual flow.

---

## Repository 14 — `alexfdezsauco/Nothing.Nauta`

- URL: https://github.com/alexfdezsauco/Nothing.Nauta
- Branch inspected: `develop`
- Files inspected: `README.md`, `src/Nothing.Nauta/SessionHandler.cs`,
  `src/Nothing.Nauta/SessionDataKeys.cs`, `src/Nothing.Nauta/Helpers/RegexProcessor.cs`,
  `src/Nothing.Nauta/Helpers/ResponseProcessors.cs`, `src/Nothing.Nauta/Helpers/TextProcessor.cs`,
  `src/Nothing.Nauta/Interfaces/ISessionHandler.cs`, `src/Nothing.Nauta/Nothing.Nauta.csproj`,
  `src/Nothing.Nauta.Cmd/Program.cs`, `src/Nothing.Nauta.Cmd/Program.Open.cs`,
  `src/Nothing.Nauta.Cmd/Program.Close.cs`, `src/Nothing.Nauta.Cmd/Program.Time.cs`,
  `src/Nothing.Nauta.Cmd/Program.Credentials.cs`, `src/Nothing.Nauta.Cmd/CommonArguments.cs`,
  `src/Nothing.Nauta.App/Services/SessionManager.cs`,
  `src/Nothing.Nauta.App/Services/AuthenticationService.cs`

### 1. Technology
- **Language / platform**: C# (.NET), `netstandard2.1` for the core library, .NET MAUI for the
  app, .NET 6+ for the CLI
- **HTTP**: `System.Net.Http.HttpClient` with `HttpClientHandler` + `CookieContainer`
- **HTML parsing**: `AngleSharp` 1.0.1 (CSS-selector-based, modern)
- **Retry / resilience**: `Polly` (used in `Program.Open.cs` for `WaitAndRetryForeverAsync` on
  `RemainingTimeAsync`)
- **Logging**: `Serilog` 2.12.0
- **JSON**: `System.Text.Json`
- **Architecture**: Clean layered design:
  - `Nothing.Nauta` (netstandard2.1) — the connector library. Exposes `ISessionHandler` and
    `SessionHandler`. Pure HTTP + parsing logic, no UI.
  - `Nothing.Nauta.Cmd` — CLI tool (`nauta-session open|close|time|credentials`).
  - `Nothing.Nauta.App` — .NET MAUI desktop/mobile app (Blazor + MAUI).
  - `Nothing.Nauta.App.Data` — data layer (account repository, etc.).
  - `Nothing.Nauta.Tests` — test project.
- **Reusable elements for a Chromium extension (TS/React)**:
  - **The `ISessionHandler` interface** (`OpenAsync`, `CloseAsync`, `RemainingTimeAsync`) is
    an excellent blueprint for NEXA's connector contract. The signature
    `Task<Dictionary<string, string>> OpenAsync(string username, string password)` returns a
    session-data dictionary that is then passed back to `CloseAsync` / `RemainingTimeAsync` —
    this is a stateless-connector pattern that maps perfectly to MV3's ephemeral SW (the
    session data lives in `chrome.storage.local`, not in connector memory).
  - **The `SessionDataKeys` constants class** — NEXA should have an equivalent branded-type
    module: `AttributeName`, `CSRFHW`, `LoggerId`, `SessionId` (= `JSESSIONID`), `Started`,
    `UserName`, `WLANUserIp`.
  - **The `ResponseProcessors` chain-of-responsibility** for error parsing — very clean.
  - **The `Polly` retry policy** for `RemainingTimeAsync` — NEXA's `chrome.alarms`-based
    retry with backoff (D03) is the conceptual equivalent.

### 2. Authentication Flow

ETECSA Wi-Fi portal — `secure.etecsa.net:8443`:

1. **Pre-login (CSRF fetch)** — `SessionHandler.OpenAsync(username, password)`:
   ```
   GET https://secure.etecsa.net:8443/
   ```
   - Uses an `HttpClient` with a `CookieContainer`. The container is queried *after* the GET
     to extract the `JSESSIONID` cookie (via `cookieContainer.GetCookies(BaseAddress)`).
   - Response is parsed with `AngleSharp`'s `BrowsingContext.New(Configuration.Default)`.
   - Form is selected by **ID**: `document.GetElementById("formulario")` — same ID as repo #12.
   - All children of the form that are `<input type="hidden">` are enumerated and added to a
     dictionary `nameValueCollection[inputElement.Name] = inputElement.Value`.
   - This captures `CSRFHW`, `wlanuserip`, `loggerId`, and any other hidden fields.

2. **Login POST** — `SessionHandler.OpenAsync(username, password)` (continued):
   ```
   POST https://secure.etecsa.net:8443/LoginServlet
   Content-Type: application/x-www-form-urlencoded  (implicit via FormUrlEncodedContent)
   ```
   - Body: `FormUrlEncodedContent(nameValueCollection)` — all hidden inputs + `username` +
     `password`.
   - **Success detection**: `EnsureGetStringAsync()` is called on the response (an extension
     method that throws on non-2xx). The response body is then scanned for the regex
     `ATTRIBUTE_UUID=([^&]+)`. If the regex matches, login is considered successful.
   - **Error detection**: the response is passed through `ResponseProcessors.Process(content)`
     (see §6 for the processor chain). Each processor either throws a typed exception
     (`UnauthorizedAccessException`, `InvalidOperationException`) or logs a warning.
   - **Session data dictionary** assembled on success:
     ```
     SessionId      = <JSESSIONID cookie value>
     ATTRIBUTE_UUID = <regex capture>
     CSRFHW         = <from hidden inputs>
     WLANUserIp     = <from hidden inputs>
     LoggerId       = <from hidden inputs>
     UserName       = <from hidden inputs>  (== the username passed in)
     Started        = DateTime.Now.ToString(CultureInfo.InvariantCulture)
     ```
   - This dictionary is the **complete** session state needed for `CloseAsync` and
     `RemainingTimeAsync`. It is JSON-serialised and persisted (CLI: to a file; app: to
     `ISecureStorage`).

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|--------------------|---------------------|
| `https://secure.etecsa.net:8443/` | GET | Fetch login form + CSRFHW + `wlanuserip` + `loggerId` + `JSESSIONID` cookie | none | HTML 200 with `#formulario` containing hidden inputs | **Login pre-step** |
| `https://secure.etecsa.net:8443/LoginServlet` | POST (form-encoded) | Wi-Fi portal login | `CSRFHW`, `wlanuserip`, `loggerId`, `username`, `password` (other hidden inputs) | HTML 200 with `ATTRIBUTE_UUID=…&` in body on success; `alert("…")` on failure | **Login** |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST (form-encoded) | Remaining time | `op=getLeftTime`, `CSRFHW`, `wlanuserip`, `loggerId` (with `+username` appended), `username`, `ATTRIBUTE_UUID`, `remove=1` | Plain text `HH:MM:SS` | **Remaining time** |
| `https://secure.etecsa.net:8443/LogoutServlet` | POST (form-encoded) | Logout | `CSRFHW`, `wlanuserip`, `loggerId` (with `+username` appended), `username`, `ATTRIBUTE_UUID`, `remove=1` | Body `logoutcallback('SUCCESS');` or `logoutcallback('FAILURE');` | **Logout** |

**Note on a critical detail in the Close/Time implementations**:
- The `sessionData` dictionary has `SessionId` and `Started` keys *removed* before being sent
  (they are local-only fields, not ETECSA parameters).
- `remove=1` is added to the body.
- `loggerId` is rewritten as `$"{loggerId}+{username}"` — i.e. the username is appended to the
  loggerId with a `+` separator. This is an ETECSA-specific quirk also visible (less cleanly)
  in repo #11. **NEXA must replicate this** or logout/time may fail.
- The `JSESSIONID` cookie is added to the `CookieContainer` manually before the POST:
  `cookieContainer.Add(BaseAddress, new Cookie("JSESSIONID", sessionId))`. This is critical:
  the `HttpClient` is created fresh for each call (no shared cookie jar), so the cookie must
  be re-injected from the persisted session data.

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443/LogoutServlet`
- Body (form-encoded): `CSRFHW`, `wlanuserip`, `loggerId+username`, `username`,
  `ATTRIBUTE_UUID`, `remove=1` — built from the persisted `sessionData` dictionary (with
  `SessionId` and `Started` removed first).
- Cookie: `JSESSIONID` (manually injected into the `CookieContainer`).
- **Requires prior session info**: yes — the full `sessionData` dictionary from `OpenAsync`.
- Success detection: `EnsureGetStringAsync()` is called on the response; the body is passed
  through `ResponseProcessors.Process()`. The processors throw on `errorop` or
  `logoutcallback('FAILURE');`. There is **no explicit check for `logoutcallback('SUCCESS');`** —
  success is implied by the absence of a thrown exception. NEXA should add an explicit success
  check for robustness.

### 5. Balance / time / session info
- **Balance (CUP)**: **Not implemented in the core library.** The `ISessionHandler` interface
  only has `OpenAsync`, `CloseAsync`, `RemainingTimeAsync`. The app/CLI does not query balance
  via the connector — balance is only available from the login response's `table#sessioninfo`
  (see repos #11/#13) and is not captured here.
- **Remaining time** — `RemainingTimeAsync(sessionData)`:
  - POST to `/EtecsaQueryServlet` with the session data + `op=getLeftTime` + `remove=1`.
  - Response: plain text `HH:MM:SS`.
  - Parsing: `response.Split(':')` → for each part, `TrimStart('0')` (then replace empty with
    `"0"`) → `int.Parse` → construct `TimeSpan(h, m, s)`.
  - **Quirk**: the `TrimStart('0')` would turn `"00"` into `""` then `"0"`, but `"09"` into
    `"9"`. This works for `int.Parse` but is unusual. NEXA should just use `parseInt` directly.
- **Connection start time**: stored as `Started` in the session data dictionary
  (`DateTime.Now.ToString(CultureInfo.InvariantCulture)` at login time). The MAUI app's
  `SessionManager.GetTimeAsync()` parses it back with `DateTime.TryParseExact(started,
  "MM/dd/yyyy HH:mm:ss", CultureInfo.InvariantCulture, …)` — note the format mismatch:
  `DateTime.Now.ToString(InvariantCulture)` does *not* produce `MM/dd/yyyy HH:mm:ss`
  reliably. This is a latent bug in the app layer.
- **Account expiration date**: not queried.
- **Total vs remaining time**: `SessionManager.GetTimeAsync()` returns a tuple
  `(TimeSpan Total, TimeSpan RemainingTime)` where `RemainingTime = Total - Elapsed` and
  `Elapsed = timeService.Now() - accountInfo.ResetDateTime`. The `ResetDateTime` is updated
  whenever the remaining time *increases* (i.e. on a fresh login or recharge). This is a
  useful pattern for NEXA's countdown display.

### 6. Scraping analysis
- **Login form**: `GetElementById("formulario")` — ID-based, **Low risk**.
- **Hidden inputs**: filtered by `inputElement.Type == "hidden"`. **Low risk.**
- **ATTRIBUTE_UUID**: regex `ATTRIBUTE_UUID=([^&]+)` — **Low risk**, canonical.
- **Error messages**: `ResponseProcessors` chain uses the regex `alert[(]"([^"]+)"[)];` to
  extract the alert text, then matches it against a curated list:
  - `"Su estado de cuenta es anormal."` → `InvalidOperationException("Anormal account status")`
  - `"Ha iniciado sesión en una semana. Reajuste el tiempo."` → `Log.Warning` (not thrown)
  - `"El usuario ya está conectado."` → `InvalidOperationException("A session is already open")`
  - `"El nombre de usuario o contraseña son incorrectos."` → `UnauthorizedAccessException`
  - `"No se pudo autorizar al usuario."` (StartsWith) → `UnauthorizedAccessException`
  - Any other non-empty alert → `InvalidOperationException(s)`
  - Also detects literal `errorop` and `logoutcallback('FAILURE');` → throws.
- **Risk assessment of the processor chain**: **Low-medium risk**. The alert regex is robust;
  the curated list is exhaustive of the known error strings. If ETECSA adds a new error
  message, the default processor catches it (throws `InvalidOperationException(s)` with the
  raw alert text). **This is the best error-handling pattern across all 15 researched repos.**

### 7. Security review
- **Credential storage (CLI)**: `FilesHelper.GetCredentialFile(alias)` returns a JSON file
  path; credentials are serialised as `{"username": "...", "password": "..."}` in plain text.
  The file location is platform-dependent (likely `~/.nauta-session/credentials.json` or
  similar). **Plain text on disk** — same anti-pattern as repo #11.
- **Credential storage (App)**: `ISecureStorage` abstraction (MAUI's `SecureStorage` API,
  which delegates to the platform keychain/keystore). **Encrypted at rest** on iOS/Android/
  macOS/Windows. This is the correct pattern; the CLI just doesn't use it.
- **Session token storage (CLI)**: JSON file (`FilesHelper.GetSessionFile()`) containing the
  full `sessionData` dictionary (including `ATTRIBUTE_UUID`, `CSRFHW`, `JSESSIONID`). Plain
  text. **Anti-pattern**.
- **Session token storage (App)**: `ISecureStorage.GetAsync(NautaSessionData)` — encrypted.
  The `SessionManager` serialises the session data to JSON and stores it under the
  `NautaSessionData` key. **Correct pattern**.
- **Logging**: `Serilog` with `Log.Information("Nauta session open for user '{Username}'.", username)`
  — the username is logged but **not the password**. The `Program.Open.cs` logs the remaining
  time. No sensitive token logging observed. NEXA's D08 (local logs only) is compatible with
  this, but NEXA should redact the username in logs (use `AccountId` branded type, never log
  raw username).
- **Cookie handling**: the `CookieContainer` is scoped to a single `HttpClient` instance per
  call — no cookie leakage between calls. The `JSESSIONID` is explicitly added to the
  container for `CloseAsync` / `RemainingTimeAsync`. **Correct isolation.**
- **Timeout**: 5-second `HttpClient.Timeout` — reasonable for ETECSA's slow portal.
- **What NOT to copy**:
  - CLI plain-text credential file.
  - CLI plain-text session-data file.
  - The `DateTime.Now.ToString(InvariantCulture)` / `TryParseExact("MM/dd/yyyy HH:mm:ss")`
    format mismatch in the app layer.
  - The `TrimStart('0')` time-parsing hack.
- **Best practices to inherit**:
  - **The `ISessionHandler` interface** — clean contract for the connector.
  - **The `SessionDataKeys` constants** — single source of truth for parameter names.
  - **The `ResponseProcessors` chain** — best-in-class error handling.
  - **The `sessionData` dictionary as the unit of session state** — JSON-serialisable,
    survives SW restarts, brandable as `SessionId` in NEXA's TS.
  - **The `loggerId+username` rewrite** on Close/Time — ETECSA-specific quirk that NEXA must
    replicate.
  - **The `remove=1` parameter** on Close/Time — confirmed by repo #11 too.
  - **The `Polly` retry pattern** — NEXA's `chrome.alarms` + backoff (D03) is the MV3
    equivalent.
  - **The `Started` timestamp** in session data — enables local countdown without polling.

### 8. Known issues / limitations
- The CLI stores credentials and session data in plain JSON files. The app uses secure
  storage. The library itself is agnostic.
- The `DateTime` format mismatch between `OpenAsync` (`ToString(InvariantCulture)`) and
  `SessionManager.GetTimeAsync` (`TryParseExact("MM/dd/yyyy HH:mm:ss")`) is a latent bug —
  on cultures where `DateTime.Now.ToString(InvariantCulture)` does not produce
  `MM/dd/yyyy HH:mm:ss`, the parse will fail and `GetTimeAsync` will return
  `(TimeSpan.Zero, TimeSpan.Zero)`. NEXA should use ISO 8601 (`toISOString()`) consistently.
- The `RemainingTimeAsync` does not validate that the response has exactly 3 colon-separated
  parts — if ETECSA returns an error page (HTML), `int.Parse` will throw and Polly will retry
  forever. The retry policy is `WaitAndRetryForeverAsync` with a 5-second delay — this could
  hammer the server. NEXA should cap retries (D03: `maxRetries`).
- The `CloseAsync` does not explicitly check for `logoutcallback('SUCCESS');` — it relies on
  the absence of `logoutcallback('FAILURE');`. If ETECSA changes the response format, logout
  may silently fail.
- The MAUI app uses `firebase_analytics` (visible in `pubspec.yaml` of repo #15, not here —
  but worth noting as a contrast for D08).
- No support for balance query in the core library — would need to be added separately (and
  would require either parsing the login response or making a separate
  `EtecsaQueryServlet` call with username/password like repo #12 does).
- The repo is well-structured (SonarCloud, Azure Pipelines, Cake build) — the engineering
  quality is the highest of all 15 researched repos. **Recommended as the primary reference
  for NEXA's connector architecture** (alongside repo #12's `NautaSession` class).

---

## Repository 15 — `luiscib3r/todo`

- URL: https://github.com/luiscib3r/todo
- Branch inspected: `main`
- Files inspected: `README.md`, `pubspec.yaml`, `lib/main_development.dart` (entry points),
  `lib/nauta/nauta.dart`, `lib/nauta/bloc/bloc.dart`,
  `lib/nauta/bloc/accounts/accounts_bloc.dart`,
  `lib/nauta/bloc/accounts/accounts_event.dart`,
  `lib/nauta/bloc/accounts/accounts_state.dart`,
  `lib/nauta/bloc/save_account/save_account_bloc.dart`,
  `lib/nauta/view/accounts_view.dart`, `lib/nauta/view/save_account_view.dart`,
  `lib/nauta/widgets/account_tile.dart`, `lib/nauta/router/nauta_location.dart`,
  `lib/app/data/repositories/nauta_repository.dart`,
  `lib/app/data/datasources/nauta/nauta_account_datasource.dart`,
  `lib/app/data/datasources/nauta/nauta_session_local_datasource.dart`,
  `lib/app/data/models/nauta/account/nauta_account.dart`,
  `lib/app/data/models/nauta/session/nauta_session.dart`,
  `lib/app/data/core/result/result.dart`, `config/ussd_codes.json`

> **Naming clarification**: The repository is named `todo` and the README headline is "TODO",
> but the README body says: *"Aplicación auxiliar para ayudar al usuario a consultar y acceder
> a los servicios de ETECSA."* The `pubspec.yaml` description is `"TODO App."`. The repo
> contains a full `lib/nauta/` feature module and a `config/ussd_codes.json` with ETECSA USSD
> codes (*222#, *99, etc.). **This is an ETECSA-related app**, just mis-named. The
> "todo" likely refers to the project being a work-in-progress / TODO list rather than a
> to-do list app.

### 1. Technology
- **Language / framework**: Dart, Flutter (SDK `>=2.12.0 <3.0.0`, null-safe)
- **HTTP**: `dio` 4.0.0 (declared in pubspec but **no nauta HTTP datasource found** in the
  inspected source — see §2)
- **State management**: `bloc` 7.2.0 + `flutter_bloc` 7.3.0
- **Forms**: `flutter_form_bloc` 0.20.6
- **Persistence**: `sqflite` 2.0.0+4 (SQLite for accounts), `shared_preferences` 2.0.6
  (for session data)
- **JSON / codegen**: `json_annotation` + `json_serializable`, `freezed` + `freezed_annotation`
- **DI**: `injectable` 1.5.0 + `get_it` 7.2.0 (with `injectable_generator`)
- **Routing**: `beamer` 0.14.1
- **Analytics**: `firebase_analytics` 8.3.2 + `firebase_core` 1.6.0 — **violates NEXA's D08**
  (zero outgoing telemetry). NEXA must NOT inherit this dependency.
- **Architecture**: Clean Architecture-ish:
  - `lib/app/data/datasources/` — local SQLite datasource for accounts, SharedPreferences
    datasource for session.
  - `lib/app/data/repositories/` — `NautaRepository` wraps the account datasource.
  - `lib/app/data/models/nauta/` — `NautaAccount`, `NautaSession` (freezed/json_serializable).
  - `lib/app/data/core/result/` — `Result<T>` freezed class (`Success` / `Error`).
  - `lib/nauta/bloc/` — `AccountsBloc`, `SaveAccountBloc`.
  - `lib/nauta/view/` — Flutter widgets for the accounts CRUD UI.
  - `lib/nauta/router/` — `NautaLocation` (Beamer route).
- **Reusable elements for a Chromium extension (TS/React)**:
  - **The `Result<T>` freezed class** is essentially the same pattern NEXA mandates
    ("`Result<T,E>` prohibiendo throws en connector layer" — see worklog critical
    constraints). The Dart version is `Result.success({T data})` / `Result.error({String message})`.
    NEXA's TS version should be `Result<T, E>` with a branded error type.
  - **The `NautaAccount` model** (`{id?, username, password}`) — minimal and clean. NEXA's
    `Account` branded type should be similar (with `AccountId` for the id).
  - **The `NautaSession` model** (`{loginAction, csrfhw, wlanuserip, attributeUuid, ssid, loggerId}`)
    is the most *complete* session-model shape across all 15 researched repos — it captures
    `ssid` and `loginAction` (the form's `action` URL) that other repos omit. NEXA's
    `SessionData` branded type should consider including these fields.
  - **The DI pattern** (`injectable` + `get_it`) is conceptually similar to NEXA's service
    registry in the SW.

### 2. Authentication Flow
- **No ETECSA login flow is implemented in the inspected source files.**
- The `NautaSessionLocalDataSource` only *saves* and *retrieves* a session to/from
  `SharedPreferences` — it does not perform the login HTTP call.
- The `NautaRepository` only wraps the account datasource (SQLite CRUD) — no login/logout/
  balance/time methods.
- The `AccountsBloc` and `SaveAccountBloc` only manage the account list (load, add, remove)
  — no session-related events.
- `dio` is declared in `pubspec.yaml` but **no nauta HTTP datasource using `dio` was found**
  in the inspected directories. It may exist in a file we did not inspect (e.g.
  `lib/app/data/datasources/nauta/nauta_session_remote_datasource.dart` — this file was *not*
  listed in the directory tree, suggesting it does not exist on the `main` branch).
- **Conclusion**: The repo, as of the inspected commit, implements only the **account
  management** feature (multi-account CRUD with SQLite) and a USSD code catalog. The actual
  ETECSA portal login flow is either not yet implemented, was removed, or lives in an
  uninspected branch. NEXA cannot extract endpoint/parameter details from this repo.
- **What IS visible** (the `NautaSession` model fields) confirms the session shape that other
  repos (#11/#12/#14) also use, adding `ssid` and `loginAction` as first-class fields.

### 3. Endpoints inventory
| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|--------------------|---------------------|
| — | — | No HTTP endpoints are referenced in the inspected source files. The `dio` dependency is declared but unused in the nauta feature module. | — | — | N/A — use repos #11/#12/#14 for endpoint details |

### 4. Logout flow
- **Not implemented.** No logout code in the inspected source.
- The `NautaSessionLocalDataSource` has no `clearSession()` / `deleteSession()` method — only
  `saveSession` and `getSession`. So even client-side session clearing is not implemented.

### 5. Balance / time / session info
- **Balance**: not queried. No HTTP datasource.
- **Remaining time**: not queried. No HTTP datasource.
- **Connection start time**: not recorded. The `NautaSession` model does not include a
  `Started` / `startedAt` field (unlike repo #14's `SessionDataKeys.Started`). NEXA should
  add this.
- **Account expiration date**: not queried.
- **Account type**: derived from the username domain in `AccountTile.accountType()`:
  - `@nauta.com.cu` → international
  - `@nauta.co.cu` → national
  - otherwise → "special"
  This is a useful classification that NEXA should inherit (it affects rate calculations and
  possibly UI badges).

### 6. Scraping analysis
- N/A — no HTML scraping is performed in the inspected source.

### 7. Security review
- **Credential storage**: SQLite via `sqflite`. The `NautaAccount` model has `username` and
  `password` fields; both are stored as plain text in the SQLite database (the
  `NautaAccountSqliteDatasource` does no encryption). The database file is in the app's
  internal storage, but on a rooted device it is readable.
- **Encryption**: none. No `flutter_secure_storage` dependency (which would be the Flutter
  equivalent of libsecret / Keychain). **Anti-pattern** — credentials at rest are plain text.
- **Session storage**: `SharedPreferences` — plain text key-value store. The `NautaSession`
  (with `csrfhw`, `attributeUuid`, etc.) is stored as a JSON string under the key
  `NAUTA_SESSION`. **Plain text.**
- **Logging**: no explicit logging in the inspected source. However, `firebase_analytics` is
  a dependency — if used (we did not find explicit calls in the inspected files, but it may
  be initialised in `main_*.dart` which we did not fully read), it would violate D08.
- **What NOT to copy**:
  - Plain-text SQLite credential storage.
  - `SharedPreferences` for session data.
  - `firebase_analytics` (D08 violation).
  - The missing `Started` timestamp in the session model.
  - The missing `clearSession` method in the local datasource.
- **Best practices to inherit**:
  - **The `Result<T>` type** — direct inspiration for NEXA's `Result<T, E>` (mandatory per
    worklog critical constraints).
  - **The `NautaSession` model shape** — most complete session model seen (includes
    `loginAction`, `ssid`).
  - **The `NautaAccount` model** — minimal, clean.
  - **The account-type derivation** from username domain (`@nauta.com.cu` vs `@nauta.co.cu`).
  - **The BLoC separation** of `AccountsBloc` (list) and `SaveAccountBloc` (form) — maps to
    NEXA's per-account vs. account-form UI state.
  - **The repository/datasource split** — `NautaRepository` wraps `NautaAccountDatasource`;
    NEXA's `AccountRepository` should follow the same pattern with
    `chrome.storage.local`-backed datasource.

### 8. Known issues / limitations
- **The repo is mis-named** ("todo") which makes it hard to discover. The README clarifies it
  is an ETECSA helper app.
- **No actual ETECSA portal flow is implemented** in the inspected source — only account CRUD
  and a USSD code catalog. The app appears to be a work-in-progress / abandoned (the last
  commit activity is not visible from the README badges, but the Flutter SDK constraint
  `>=2.12.0 <3.0.0` predates Flutter 3.x).
- **No secure storage** — credentials and session are in plain text.
- **Firebase analytics** dependency declared (potential D08 violation if NEXA were to inherit
  it — but NEXA is Chromium/TS, so this is moot).
- **No tests** for the nauta feature module (the `test/` directory exists but we did not
  inspect it; the README badge references a `tests.yml` workflow).
- **The `ussd_codes.json` config** is a useful reference for ETECSA's USSD codes (`*222#`
  for balance, `*222*266#` for bonus, `*99{phone}` for reverse-charge calls, etc.). NEXA
  could surface these as a "quick actions" feature in a future phase, but it is **out of
  scope for Fase 1** (D09: prepaid only, no USSD integration).

---

## Cross-cutting findings (Batch 3)

### A. The canonical ETECSA Wi-Fi portal flow (confirmed by 3 of 5 repos)

Repos #11, #12, #14 (and partially #13) converge on the same flow:

```
1. GET https://secure.etecsa.net:8443/
   → Parse #formulario, extract hidden inputs: CSRFHW, wlanuserip, loggerId, …
   → Capture JSESSIONID cookie from response

2. POST https://secure.etecsa.net:8443/LoginServlet
   Content-Type: application/x-www-form-urlencoded
   Cookie: JSESSIONID=<from step 1>
   Body: CSRFHW=<...>&wlanuserip=<...>&loggerId=<...>&username=<...>&password=<...>
   → On success: response body contains "ATTRIBUTE_UUID=<uuid>&" (in a <script> tag)
   → On failure: response body contains alert("...") with the error reason
   → Some repos also detect success via a redirect to a URL containing "online.do"

3. POST https://secure.etecsa.net:8443/EtecsaQueryServlet
   Body: CSRFHW=<...>&wlanuserip=<...>&loggerId=<...>+<username>&username=<...>&
         ATTRIBUTE_UUID=<...>&op=getLeftTime&remove=1
   Cookie: JSESSIONID=<from step 1>
   → Response: plain text "HH:MM:SS"

4. POST https://secure.etecsa.net:8443/LogoutServlet
   Body: CSRFHW=<...>&wlanuserip=<...>&loggerId=<...>+<username>&username=<...>&
         ATTRIBUTE_UUID=<...>&remove=1
   Cookie: JSESSIONID=<from step 1>
   → Response: "logoutcallback('SUCCESS');" or "logoutcallback('FAILURE');"
```

**Critical quirks all 3 repos agree on**:
- The `loggerId` is rewritten as `loggerId+username` (with a literal `+`) on time/logout calls.
- The `remove=1` parameter is mandatory on time/logout calls.
- The `JSESSIONID` cookie must be forwarded (or re-injected) on all post-login calls.
- The login form is identified by `id="formulario"` (repos #12, #14) — repo #11's positional
  XPath is the outlier and should not be used.
- The `ATTRIBUTE_UUID` is extracted from the response body via regex `ATTRIBUTE_UUID=([^&]+)`.
- The pre-login GET must be performed immediately before each login attempt (CSRFHW expires
  within minutes).

### B. CSRF token handling

- **CSRFHW is not a cookie** — it is a hidden form input fetched from the login page and
  echoed back in the POST body.
- The `JSESSIONID` cookie is the *session* identifier; `CSRFHW` is the *request
  authenticator*.
- Repos #12 and #14 both lowercase the hidden input name when storing (`csrfhw`) but send it
  as `CSRFHW` (uppercase) in the POST body. ETECSA's portal expects uppercase `CSRFHW`.
- NEXA's connector must:
  1. Fetch `https://secure.etecsa.net:8443/` with `credentials: 'include'` (or manage the
     `JSESSIONID` cookie manually via `chrome.cookies` API).
  2. Parse the HTML (DOMParser in the SW, or offload to a tab) and extract hidden inputs
     from `#formulario`.
  3. Send the login POST with all hidden inputs + `username` + `password`.

### C. Session state shape

The union of fields across all repos gives NEXA's `SessionData` branded type:

| Field | Source repos | Required for | NEXA recommendation |
|-------|--------------|--------------|---------------------|
| `CSRFHW` | #11, #12, #13, #14 | login, time, logout | **Required** |
| `wlanuserip` | #11, #12, #13, #14 | login, time, logout | **Required** |
| `loggerId` | #13 (explicit), #14 (explicit), #11 (hidden) | login, time, logout (with `+username` suffix) | **Required** — generate as `yyyyMMddHHmmssSSS` per repo #13 |
| `username` | all | time, logout | **Required** |
| `ATTRIBUTE_UUID` | all | time, logout | **Required** |
| `JSESSIONID` | #14 (explicit), #12 (implicit via cookiejar) | time, logout (cookie) | **Required** — store as a cookie or as a field |
| `loginAction` (form action URL) | #12 (state.login_url), #15 (model field) | login (target URL) | **Recommended** — defaults to `/LoginServlet` |
| `ssid` | #13 (sent empty), #15 (model field) | login (sent empty) | **Optional** — send empty string for compatibility |
| `Started` (local timestamp) | #14 (SessionDataKeys.Started) | UI countdown | **Recommended** — ISO 8601 |
| `wlanacname`, `wlanmac`, `firsturl`, `usertype`, `gotopage`, `successpage`, `lang` | #13 (explicit) | login (mobile path) | **Optional** — only if emulating mobile client |

### D. Error catalogue (union of all alert strings observed)

| Alert string (Spanish) | Meaning | Source repos |
|------------------------|---------|--------------|
| `"El nombre de usuario o contraseña son incorrectos"` | Wrong username or password | #13, #14 |
| `"No se pudo autorizar al usuario"` | Cannot authorize user (CSRF expired? account locked?) | #11, #13, #14 |
| `"Usted ha realizado muchos intentos"` / `"Usted a realizado muchos intentos"` | Too many attempts (rate-limited) | #11, #13 (note typo variant) |
| `"Su tarjeta no tiene saldo disponible"` / `"El saldo de su cuenta es insuficiente"` | Insufficient balance | #11, #13 |
| `"El usuario ya está conectado"` | User already connected (concurrent session) | #14 |
| `"Su estado de cuenta es anormal."` | Account state abnormal | #14 |
| `"Ha iniciado sesión en una semana. Reajuste el tiempo."` | Logged in for a week — time adjustment required | #14 |
| `"Usted está conectado"` | You are connected (success indicator) | #11 |

NEXA's connector should map each of these to a typed `EtecsaError` variant in the `Result<T, E>`
error channel.

### E. Security patterns — what to inherit and what to avoid

| Pattern | Repos that do it right | Repos that do it wrong | NEXA decision |
|---------|------------------------|------------------------|---------------|
| Credential storage | #12 (libsecret), #14 app (ISecureStorage) | #11 (plain INI), #13 (plain JSON), #14 CLI (plain JSON), #15 (plain SQLite) | D04: master password + PBKDF2 + AES in `chrome.storage.local`; AES key in `chrome.storage.session` |
| Session token storage | #14 app (ISecureStorage) | #11 (plain .datalogin), #13 (plain JSON), #15 (plain SharedPreferences) | D04: encrypt SessionData before persisting |
| Logging | #14 (Serilog, no password logging) | #11 (`print(dinero_str)`), #13 (`System.out.println`), #15 (firebase_analytics risk) | D08: local logs only, redact usernames, no telemetry |
| Cookie isolation | #14 (per-call CookieContainer) | #11 (reuses `x1.cookies` inconsistently), #13 (fresh connection per call, loses cookies) | NEXA: use `chrome.cookies` API or manual cookie management in SW |
| Timeout | #14 (5s HttpClient.Timeout) | #11 (5s on some calls, none on others), #13 (none), #12 (libsoup default) | NEXA: 5–10s `AbortController` per fetch |
| Retry / backoff | #14 (Polly WaitAndRetryForever — but infinite!) | none in others | D03: `maxRetries` + backoff, capped |

### F. Architectural blueprints for NEXA's connector layer

Ranked by closeness to NEXA's needs (MV3 / TS / ephemeral SW / branded types / Result<T,E>):

1. **Repo #14 (`Nothing.Nauta`) — primary architectural reference.**
   - `ISessionHandler` interface → NEXA's `EtecsaConnector` contract.
   - `SessionDataKeys` constants → NEXA's branded `SessionData` type.
   - `ResponseProcessors` chain → NEXA's error parser.
   - `sessionData` dictionary as the stateless session handle → survives SW restarts in
     `chrome.storage.local`.
   - `Polly` retry → NEXA's `chrome.alarms` + backoff (D03).

2. **Repo #12 (`nauta-connect-gnome-extension`) — secondary reference, especially for the
   `NautaSession` class shape and the `online.do` success detection.**
   - Cleanest single-file connector implementation.
   - Uses `#formulario` ID (same as repo #14).
   - The `state = { csrfhw, wlanuserip, login_url, auth }` shape is the minimal viable
     session state.

3. **Repo #15 (`luiscib3r/todo`) — reference for the `Result<T>` type and the
   `NautaSession`/`NautaAccount` model shapes only.** No connector logic to inherit.

4. **Repo #11 (`pywifietecsa`) — reference for the endpoint map and the
   `op=getLeftTime` pattern; otherwise mostly cautionary (positional XPath, plain-text
   credentials, the `*6` balance-to-time formula is wrong).**

5. **Repo #13 (`nauta-connect-apk`) — reference for the explicit mobile-path parameters
   (`gotopage`, `successpage`, `lang=es_ES`, `loggerId` format); otherwise the implementation
   is buggy (double login call, switch fall-through, broken second POST).**

### G. Open questions for Phase 2 (Architecture)

1. **Cookie management in MV3**: should NEXA use the `chrome.cookies` API (requires
   `cookies` permission, broader host permissions) or manage cookies manually by reading
   `Set-Cookie` headers from `fetch()` responses and replaying them as `Cookie` headers?
   The latter is more self-contained but loses `HttpOnly` protection. Repos #12 and #14
   both use a cookie jar (libsoup / CookieContainer) — equivalent to manual management.

2. **Mobile vs desktop client emulation**: repo #13 sends
   `gotopage=/nauta_etecsa/LoginURL/mobile_login.jsp` and
   `successpage=/nauta_etecsa/OnlineURL/mobile_index.jsp` which may produce smaller
   responses. Worth A/B-testing in Phase 6 to decide which path NEXA should emulate.

3. **Balance query strategy**: the only way to get the *current* balance (CUP) of an account
   that is *not* currently connected is to perform a full login (which connects the account)
   and parse `table#sessioninfo`. This is wasteful and creates a dangling session. NEXA
   should either:
   - (a) Only query balance immediately after login (capture it from the login response),
     then never again; or
   - (b) Query balance via the Nauta user portal (`portal.nauta.cu`) — but that requires
     CAPTCHA (D01: out of scope for Fase 1).
   - **Recommendation**: option (a). Capture balance at login, display it, and use
     `op=getLeftTime` for the live countdown.

4. **`loggerId+username` format on time/logout**: this is confirmed by repos #11 and #14
   but not by #12 (which does not modify loggerId). NEXA should test both with and without
   the `+username` suffix in Phase 6 to determine which is currently required.

5. **CSRF expiry window**: no repo documents how long `CSRFHW` remains valid. NEXA should
   fetch it immediately before each login attempt and treat any "No se pudo autorizar al
   usuario" error as a CSRF-expiry signal, triggering a re-fetch + retry (one retry max).

### H. Concrete artifacts produced for Phase 2

From this batch, NEXA Phase 2 should produce:

1. **`SessionData` branded type** (TS) — fields per §C above.
2. **`EtecsaError` branded union type** — variants per §D above.
3. **`EtecsaConnector` interface** — methods: `buildSession()`, `login()`, `logout()`,
   `remainingTime()`, `userCredits()` (the last one only if balance-from-active-session is
   confirmed viable in Phase 6 testing).
4. **`EtecsaConnectorImpl`** — concrete implementation using `fetch()` + `AbortController`,
   based on the flow in §A.
5. **`ResponseProcessor` chain** — port of repo #14's `ResponseProcessors` to TS.
6. **`SessionDataKeys` constants module** — port of repo #14's `SessionDataKeys`.
7. **Retry policy** — `chrome.alarms`-based, with `maxRetries` (D03) and backoff, replacing
   repo #14's infinite Polly retry.

---

*End of Phase 1 Research — Batch 3 of 3.*
