# NEXA NautaX — Fase 1 · Research Batch 2

**Project**: NEXA NautaX (Chromium extension for ETECSA Nauta accounts)
**Batch**: 2 of 3 (repos 6–10)
**Author**: general-purpose sub-agent (Phase 1 research)
**Date**: 2026-06 (worklog reference)
**Source**: raw.githubusercontent.com (GitHub REST API was rate-limited; all data retrieved via `curl` against `raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` and the public HTML tree pages on `github.com`).

Repositories analysed:

| # | Repo | URL | Default branch | Verdict |
|---|------|-----|----------------|---------|
| 6 | mamei-tech/cnauta | https://github.com/mamei-tech/cnauta | `main` | **High value** — dual Python + C# captive-portal client |
| 7 | TheMrAleX/econnect | https://github.com/TheMrAleX/econnect | `main` | Medium value — small Python module, plaintext credentials |
| 8 | chenryhabana205/qvacall-cli | https://github.com/chenryhabana205/qvacall-cli | `master` | **High value** — JS/Node, closest to extension architecture |
| 9 | jvila8512/etecsaApp | https://github.com/jvila8512/etecsaApp | `master` | **Off-topic** — JHipster industrial Modbus supervisor, not Nauta |
| 10 | EtecsaCu/EtecsaNauta | https://github.com/EtecsaCu/EtecsaNauta | `master` | Built React PWA for the **Nauta user portal** (nauta.cu:5002), not the captive portal |

> Methodological note: GitHub's REST API returned `403 rate limit exceeded` for the entire sandbox IP range. All file contents below were obtained by directly fetching `https://raw.githubusercontent.com/...` and by parsing the GitHub tree-page HTML for path discovery. This is equivalent to the API for content-retrieval purposes.

---

## Repo 6 — `mamei-tech/cnauta`

**Tagline**: "CNauta — Gestión de hasta 3 cuentas de acceso … permite hacer logout aunque el programa se cierre." GPL-licensed desktop client for the Nauta captive portal, shipped as a Python CLI (`multiplatform/python/`) **and** a C# WinForms tray app (`win/cnauta/`). Both implementations talk to the same captive-portal backend. The C# source is far richer (separates login / logout / time-left / account-status / crash-recovery), so most findings below come from `MHttpCnx.cs`.

### 1. Technology
- **Python implementation** (`multiplatform/python/main.py`, 195 LOC): Python 3.9+, `requests ^2.31`, `beautifulsoup4`, `configparser`, `argparse`, `threading`. Managed with Poetry. Single-file CLI.
- **C# implementation** (`win/cnauta/`): .NET / WinForms, `HttpClient`, `HtmlAgilityPack` for HTML parsing, `Newtonsoft.Json` for config persistence. Clean MVC split: `model/` (`MHttpCnx`, `MConfigMgr`, schemas), `controller/` (`CMainMenu`, `CConfig`, `GhKeyHandler`), `view/` (WinForms). Tray-icon app; up to 3 accounts (`DefaultUser`, `AltAUSer`, `AltBUSer`).
- **Architecture**: classical MVC. The model `MHttpCnx` is a stateless HTTP wrapper that holds `_csrfHwToken`, `_logIdToken`, `_uuidToken`, `_cookies` per instance. The controller persists these tokens into `appconfig.json` after every successful connect so that logout can be replayed after a crash.
- **Reusable elements for NEXA NautaX**:
  - The `MHttpCnx` class is essentially a ready-made reference implementation of the captive-portal state machine (Prequel → Connect → getLeftTime → Disconnect), 1:1 translatable to TypeScript.
  - The `PLoginResult` enum (OK / WRONG_PASS / USER_INVALID / MANY_ATTEMPTS / ACCOUNT_OUT_TIME / ALREADY_CONN) is the canonical ETECSA error map — should be lifted verbatim into NEXA's `EtecsaError` branded union.
  - The `SchConfigData` schema (user/pass for N accounts + `CsrfHwToken` / `LogIdToken` / `UuidToken` / `AreWeConnected` / `ActiveAccount`) is a useful template for `chrome.storage.local` account records, minus the plaintext password (which NEXA will replace with ciphertext, per D04).
  - The disconnect-retry counter (`_dCnxAttempts`, max 2 before forced local state clear) is a pragmatic ETECSA-specific resilience pattern worth inheriting.

### 2. Authentication Flow

**Pre-login (CSRF fetch) — required in every implementation:**

| Step | Method | URL | Headers | Body | Result |
|------|--------|-----|---------|------|--------|
| 1 | GET | `https://secure.etecsa.net:8443/` | `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/102.0`<br>`Accept-Encoding: gzip, deflate, br` | — | HTML 200; `Set-Cookie` headers captured into `CookieContainer`; the page contains `<input name="CSRFHW" value="…">`. |

The Python implementation scrapes only `CSRFHW`:

```python
self.csrfhw = soup.select_one("input[name=CSRFHW]")["value"]
self.cookies = execute.cookies
```

The C# implementation does the same with HtmlAgilityPack:

```csharp
_csrfHwToken = doc.DocumentNode.SelectSingleNode("//input[@name='CSRFHW']").Attributes["value"].Value;
_cookies = new CookieContainer();
foreach (var cookie in r.Headers.GetValues("Set-Cookie"))
    _cookies.SetCookies(new Uri(StrsHots.HOST_URL), cookie);
```

**Logger ID:** cnauta **generates `loggerId` locally** as `DateTime.Now.ToString("yyyyMMddHHmmssfff")` (Python equivalent: `datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")`). It does NOT scrape `loggerId` from the page form. ⚠️ Note: this differs from econnect (repo 7) and qvacall-cli (repo 8), which scrape it from the landing form. Both approaches are observed working; cnauta's choice is more fragile if ETECSA ever validates loggerId against the CSRFHW issuance.

**Login request:**

| Field | Value |
|-------|-------|
| URL | `https://secure.etecsa.net:8443//LoginServlet` ⚠️ **double slash** — preserved verbatim in both Python (`source_url_login_servlet = self.source_url + "//LoginServlet"`) and C# (`HOST_URL_LOGIN = $"{HOST_URL}//LoginServlet"`). ETECSA's servlet container treats `//LoginServlet` and `/LoginServlet` as equivalent; the double slash is preserved for fingerprint-compatibility with the official portal form action. |
| Method | POST |
| Content-Type | `application/x-www-form-urlencoded` (form-encoded, NOT JSON) |
| Cookies | The `CookieContainer` populated by the prequel GET is replayed. |
| Headers | `User-Agent`, `Accept-Encoding: gzip, deflate, br` |

**Form body parameters (order preserved from `mkReqCnxData`):**

| Parameter | Value | Origin |
|-----------|-------|--------|
| `wlanacname` | `""` (empty) | hard-coded |
| `wlanmac` | `""` (empty) | hard-coded |
| `firsturl` | `notFound.jsp` | hard-coded |
| `ssid` | `""` (empty) | hard-coded |
| `usertype` | `""` (empty) | hard-coded |
| `gotopage` | `/nauta_etecsa/LoginURL/mobile_login.jsp` | hard-coded |
| `successpage` | `/nauta_etecsa/OnlineURL/mobile_index.jsp` | hard-coded |
| `loggerId` | `<yyyyMMddHHmmssfff>` | generated locally |
| `lang` | `es_ES` | hard-coded |
| `username` | `<user@nauta.com.cu>` | user input |
| `password` | `<plaintext>` | user input |
| `CSRFHW` | `<token from prequel>` | scraped |

**Cookies set by server during prequel**: captured into `CookieContainer` but never inspected by name. The implementation treats the cookie jar as an opaque blob and re-sends it verbatim. NEXA should do the same — `fetch(..., {credentials: 'include'})` with a `cookieStoreId` per account is the extension-native equivalent.

**Session tokens generated on success**: the response HTML embeds a script tag containing `ATTRIBUTE_UUID=<hex>&...`. cnauta scrapes it via `nodes.hlp_GetUUID()`:

```csharp
var guuid = node.InnerText
    .Split(new[] { "ATTRIBUTE_UUID=" }, StringSplitOptions.None)[1]
    .Split('&')[0];
```

This `ATTRIBUTE_UUID` is the **logout credential** — it must be persisted across browser/SW restarts or logout becomes impossible (the user's hours keep draining until expiry).

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|-------------------|--------------------|
| `https://secure.etecsa.net:8443/` | GET | Landing / CSRF fetch | — | HTML 200 with `<input name="CSRFHW">`; sets session cookies | Mandatory pre-step for every login attempt |
| `https://secure.etecsa.net:8443//LoginServlet` | POST | Login (form-encoded) | See table above | HTML 200; success → embedded `ATTRIBUTE_UUID=<hex>`; failure → `<script>alert("…")</script>` with one of 5 known Spanish strings | Primary login endpoint |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | Account status (balance + state) | Same form body as login (`wlanacname`, `wlanmac`, `firsturl`, `ssid`, `usertype`, `gotopage`, `successpage`, `loggerId`, `lang`, `username`, `password`, `CSRFHW`) | HTML 200 with `<table id="sessioninfo">…</table>`; rows: `[0]=? [1]=saldo [2]=? [3]=estado` | Optional: query balance without opening a session (returns account state when **not** connected) |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | Time left (active session) | `ATTRIBUTE_UUID`, `wlanacname=""`, `wlanmac=""`, `username`, `CSRFHW`, `domain=""`, `ssid=""`, `op=getLeftTime`, `loggerId=<id>+<username>` | Plain-text body in `HH:MM:SS` format (split by `:` yields 3 parts) | Primary "remaining time" endpoint while connected |
| `https://secure.etecsa.net:8443/LogoutServlet` | POST | Logout | `username`, `ATTRIBUTE_UUID`, `wlanacname=""`, `domain=""`, `remove=1`, `loggerId=<id>+<username>` | Plain-text body; `FAILURE` substring ⇒ failure, anything else ⇒ success | Primary logout endpoint |

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443/LogoutServlet`
- Parameters (form-encoded): `username`, `ATTRIBUTE_UUID` (scraped at login), `wlanacname=""`, `domain=""`, `remove=1`, `loggerId=<original_id>+<username>`.
- **Requires prior session info**: YES — specifically the `ATTRIBUTE_UUID` and the original `loggerId`. cnauta persists both into `appconfig.json` (C#) / `config.cfg` (Python) immediately after a successful login, precisely so that logout can be replayed after a crash.
- **Success detection**: cnauta treats the response body as a tiny string; if it contains `FAILURE` ⇒ logout failed (warning shown, retry counter incremented); otherwise ⇒ success. The Python implementation uses the same `FAILURE` substring check.
- **Resilience pattern** (C# `CMainMenu.VActionDisconnect`): if `_dCnxAttempts > 2`, the app **forcibly clears local connected-state** (`AreWeConnected=false`, `ActiveAccount=-1`, tokens emptied) and shows the message *"Servers says can't disconnect again... But we are setting the app up to disconnection state anyways."* This is the right UX for ETECSA, where stale UUIDs frequently cause logout to fail.

### 5. Balance / time / session info
- **Balance (CUP)** — `TryToGetAccountSts` POSTs the **same form body as login** to `EtecsaQueryServlet`, then scrapes the resulting HTML:

  ```csharp
  var balance = (doc.DocumentNode.SelectNodes("//td"))[3];
  // balance.InnerText looks like "12.34 CUP"
  return balance.InnerText.Contains("CUP")
      ? Double.Parse(new string(balance.InnerText.Where(c => Char.IsDigit(c) || Char.IsPunctuation(c)).ToArray()))
      : -1;
  ```

  The Python `state()` method scrapes the same table via BeautifulSoup: `table#sessioninfo > tbody > tr > td`, taking index 1 for saldo and index 3 for estado. The two implementations index different `<td>` positions because the C# version loads the **whole document** (`//td`) and the Python version scopes to the table; both ultimately read the same physical cells.

- **Remaining time** — `TryToGetTmLeft` POSTs to `EtecsaQueryServlet` with `op=getLeftTime`. Response is plain text `HH:MM:SS` (not HTML). Split by `:` ⇒ `[hours, minutes, seconds]`.
- **Connection start time** — **not exposed** by cnauta. The captive portal does not appear to return it in a scrapable form (only elapsed/remaining time).
- **Account expiration date** — **not exposed** by cnauta. (The captive portal at `secure.etecsa.net:8443` does not surface account-level expiration; that data lives on the separate **user portal** at `https://www.nauta.cu:5002` — see repo 10.)
- **Strategy**: hybrid — `getLeftTime` is a near-structured text response (low fragility); `EtecsaQueryServlet`-with-login-body for balance is HTML scraping (medium fragility, see §6).

### 6. Scraping analysis
| Target | Selector / regex | Fragility | Mitigation if ETECSA changes HTML |
|--------|------------------|-----------|-----------------------------------|
| CSRFHW token | `//input[@name='CSRFHW']` (Python: `input[name=CSRFHW]`) | **Low** — input name is semantically tied to the CSRF contract; unlikely to be renamed without breaking the form action. | Fall back to "send back every form input" (qvacall-cli's strategy, repo 8). |
| Login error reason | Spanish substring match against the **last** `<script>` tag's inner text: `"El nombre de usuario o contraseña son incorrectos."` / `"No se pudo autorizar al usuario."` / `"Usted a realizado muchos intentos."` / `"Su tarjeta no tiene saldo disponible."` / `"El usuario ya está conectado."` | **High** — depends on exact Spanish copy text and on ETECSA keeping `<script>alert("…")</script>` as the failure transport. | Maintain a regex pattern table rather than literal `String.Contains`; treat unknown alert as a generic `LOGIN_FAILED_UNKNOWN` and surface the raw text in dev-mode logs. |
| ATTRIBUTE_UUID | `node.InnerText.Split("ATTRIBUTE_UUID=")[1].Split('&')[0]` | **Medium** — depends on the substring `ATTRIBUTE_UUID=` appearing in a `<script>` block. | Use regex `ATTRIBUTE_UUID=([A-F0-9]+)` (qvacall-cli's approach) with a guard for length ≥ 10. |
| Balance | `//td[3]` text content (or `table#sessioninfo > tbody > tr > td[1]`) | **High** — positional index of a `<td>` inside a table whose structure is undocumented. | Scope to `table#sessioninfo` (Python's approach is safer than C#'s global `//td`); extract by sibling-label regex (`Saldo.*?(\d+(?:\.\d+)?)\s*CUP`). |
| Time-left response | Plain text `HH:MM:SS`, split on `:` | **Low** — response is not HTML. | Validate `parts.length === 3 && /^\d{1,2}$/.test(parts[0])` before consuming. |

### 7. Security review
- **Credential storage**: **plaintext**.
  - Python: `[CREDENTIAL] username=…\npassword=…` in `config.cfg` next to the binary.
  - C#: `appconfig.json` with `DefaultUserPass`, `AltAUSerPass`, `AltBUSerPass` in cleartext JSON.
- **Encryption**: none. Only defence is a file-size guard in `MConfigMgr.LoadConfig` (`if ((new FileInfo(Strs.CONFIG_FILE)).Length > 35000) return null;`) to refuse abnormally large config files — a weak anti-tampering heuristic, not encryption.
- **Logging of sensitive info**: not directly logged, but the C# source defines `MSG_NTF_ACC_STS_DATA = "balance: {0} CUP\nhours: {1}"` and shows it as a Windows tray tooltip — that is **balance** exposure, not credentials. The Python `state()` method `print`s saldo/estado to stdout. No password/CSRFHW/UUID is logged.
- **Session tokens persisted**: yes — `CsrfHwToken`, `UuidToken`, `LogIdToken` are written to `appconfig.json` so logout survives a crash. This is **necessary** for ETECSA (without `ATTRIBUTE_UUID`, logout is impossible). NEXA must inherit this pattern but store the tokens encrypted (D04: master-password + PBKDF2-derived AES key in `chrome.storage.session`).
- **What NOT to copy**:
  - Plaintext credential storage in `appconfig.json` / `config.cfg`.
  - The 3-account hard cap (`DefaultUser` / `AltAUSer` / `AltBUSer`) baked into the schema. NEXA is multi-account-unbounded (D02).
  - The `_dCnxAttempts` counter living on the controller instance — for MV3 this must live in `chrome.storage.local` because the SW is ephemeral.
  - `goto` statement in `VActionDisconnect` (C# anti-pattern).
- **Best practices to inherit**:
  - The `PLoginResult` enum as a closed set of ETECSA error codes.
  - The crash-recovery-by-persisting-tokens pattern (with the encryption upgrade above).
  - The forced-disconnect-state-clear after N failed retries (avoids "stuck connected" UX).
  - The 25-second timeout (`TIMEOUT = 25000` ms) — reasonable for ETECSA's slow captive portal.
  - The forced `Accept-Encoding: gzip, deflate, br` + Firefox User-Agent combo (server returns different HTML for missing UA).

### 8. Known issues / limitations
- **Python implementation is a minimal CLI** — no time-left query, no auto-reconnect, no crash recovery. Only login, logout, and a single balance check (`state()`). Thread wrapping in `execute_menu` is buggy: `threading.Thread(target=_nauta.do_login())` calls the method **immediately** (note the `()`) and passes its return value (None) as the target — the thread does nothing. This is a latent bug.
- **C# `MConfigMgr.LoadConfig` comment says "3500 bytes" but the code checks "35000"** — doc/code drift.
- **`Strs.PORTAL_RES_MANY_ATTEMPTS = "Usted a realizado muchos intentos."`** — grammatical typo in the original ETECSA string ("a realizado" should be "ha realizado"). cnauta preserves the typo deliberately to match the server response byte-for-byte. NEXA must do the same.
- **Double slash in `HOST_URL_LOGIN`** (`//LoginServlet`) is intentional but undocumented; a future refactor would likely "fix" it and break login silently. Add a unit test that pins this string.
- **No retry/backoff**: the C# controller catches `HttpRequestException` and `TaskCanceledException` but simply displays an error; no exponential backoff, no auto-reconnect. NEXA needs to add this (D03).
- **No CSRF token reuse**: each `TryToConnect` / `TryToGetAccountSts` call re-runs `Prequel()` (a fresh GET to fetch a new CSRFHW). This is wasteful but correct; ETECSA CSRFHW tokens appear to be single-use per session.

---

## Repo 7 — `TheMrAleX/econnect`

**Tagline**: "un módulo de Python para interactuar con el Portal Cautivo de Etecsa hecho en su totalidad con Python puro". A single-class pip-installable Python module (`from enet import econnect`) wrapping the captive portal. Small (213 LOC including comments), beginner-coded but functional. Ships with a separate `econnect-gui` project (not analysed here).

### 1. Technology
- **Language**: Python (README claims 3.12; `pyproject.toml` declares `python = "^3.7"`).
- **HTTP client**: `httpx.Client` (sync) — see `self.cliente = httpx.Client()`. ⚠️ Mismatch: `pyproject.toml` and `requirements.txt` declare `requests` and `beautifulsoup4`, not `httpx`. The code clearly uses `httpx` (e.g. `httpx.TimeoutException`, `httpx.ConnectError`, `self.cliente.post(..., follow_redirects=True)`). The dependency manifests are stale.
- **HTML parser**: `bs4.BeautifulSoup` (`from bs4 import BeautifulSoup as bs`).
- **Regex**: `re` for error detection and ATTRIBUTE_UUID extraction.
- **Persistence**: plain `json` files (caller-supplied path).
- **Architecture**: one class `nauta` with methods `test_net`, `login_net`, `get_time`, `save_data`, `load_data`, `logout`, `logout_back`, `reanude_login`. The `httpx.Client` instance lives on `self`, so cookies are automatically persisted across requests within the same `nauta` instance — there is no manual cookie jar management.
- **Reusable elements for NEXA NautaX**:
  - `test_net()` pattern: GET `https://secure.etecsa.net:8443/` with a 5-second timeout; treat `status_code == 200` as "portal reachable". Useful for NEXA's offline-detection (D07) — although NEXA should additionally probe `https://www.google.com/generate_204` to distinguish "offline" from "behind captive portal but not yet authenticated".
  - `save_data` / `load_data` / `logout_back` / `reanude_login` — the **crash-recovery session file** pattern. NEXA's MV3 equivalent should store the same fields (`ATTRIBUTE_UUID`, `loggerId`, `wlanuserip`, `CSRFHW`, `username`, `remove`) inside an encrypted account record.
  - The triple-scrape (CSRFHW + loggerId + wlanuserip) from the landing form is more complete than cnauta's CSRFHW-only scrape — important because qvacall-cli (repo 8) confirms `wlanuserip` is genuinely present and required.

### 2. Authentication Flow

**Pre-login (`test_net`)**:

| Field | Value |
|-------|-------|
| URL | `https://secure.etecsa.net:8443/` |
| Method | GET |
| Timeout | 5 s |
| Headers | `User-Agent: Mozilla/5.0(Windows NT 10.0; Win64; x64; rv: 117.0.1)` (no `Accept-Encoding`) |
| Result | `self.soup` is set to the parsed landing page; the `httpx.Client` retains the session cookies automatically. |

**Login (`login_net`)** — scrapes **three** hidden inputs from the landing form:

```python
self.token_csrf = self.soup.find('input', {'name': 'CSRFHW'}).get('value')
self.logger_id  = self.soup.find('input', {'name': 'loggerId'}).get('value')
self.wlanuserip = self.soup.find('input', {'name': 'wlanuserip'}).get('value')
```

⚠️ This is the only one of the three implementations analysed that **reads `loggerId` and `wlanuserip` from the form rather than synthesising them**. The divergence matters: cnauta synthesises `loggerId` locally and sends `wlanuserip=""`; econnect sends the server-supplied values. Both work today, which suggests ETECSA does not strictly validate either field. NEXA should prefer econnect's "scrape everything the form gives you" stance (and pair it with qvacall-cli's "scrape ALL inputs" stance for maximum robustness).

| Field | Value |
|-------|-------|
| URL | `https://secure.etecsa.net:8443/LoginServlet` (single slash — note the divergence from cnauta/qvacall-cli's `//LoginServlet`) |
| Method | POST |
| Content-Type | `application/x-www-form-urlencoded` (httpx `data=` parameter) |
| Cookies | automatic via `httpx.Client` |
| Headers | `User-Agent` only |
| Follow redirects | `True` |

**Form body parameters**:

| Parameter | Value |
|-----------|-------|
| `loggerId` | scraped from form |
| `wlanuserip` | scraped from form |
| `CSRFHW` | scraped from form |
| `username` | user input |
| `password` | user input |

⚠️ econnect sends **only 5 fields**; cnauta sends 12 (the difference is the empty `wlanacname`, `wlanmac`, `ssid`, `usertype`, `firsturl`, `gotopage`, `successpage`, `lang`). ETECSA evidently accepts both — the additional fields are optional. NEXA should mirror cnauta's 12-field payload to maximise fingerprint-match with the official web flow.

**Success detection** (idiosyncratic):

```python
errors = re.compile(r'alert\((.*?)\)')
error = re.findall(errors, self.data_log.text)
if len(error) == 12:
    # success — extract ATTRIBUTE_UUID
    self.attribute_uuid = re.findall(r'ATTRIBUTE_UUID=([A-F0-9]+)', self.data_log.text)[1]
    return True
else:
    return error[2]  # returns the 3rd alert string as the error message
```

The author's comment: *"si hay 12 elementos en la lista no habra ningun error al iniciar sesion"*. This is a **count-based heuristic**: the success page apparently contains exactly 12 `alert(...)` calls in its inline scripts, while failure pages contain a different number. ⚠️ **Extremely fragile** — if ETECSA adds or removes a single `alert()` on either page, this check breaks. NEXA must NOT copy this; instead use qvacall-cli's alert-regex approach.

**ATTRIBUTE_UUID extraction**: `re.findall(r'ATTRIBUTE_UUID=([A-F0-9]+)', text)[1]` — takes the **second** match. Implies the success page contains the substring twice (likely once in a script for session setup and once in a form/data attribute). This is consistent with qvacall-cli's experience.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|-------------------|--------------------|
| `https://secure.etecsa.net:8443/` | GET | Landing / CSRF + loggerId + wlanuserip fetch + cookie seeding | — | HTML 200 with the login form `<form>…</form>` | Mandatory pre-step |
| `https://secure.etecsa.net:8443/LoginServlet` | POST | Login | `loggerId`, `wlanuserip`, `CSRFHW`, `username`, `password` | HTML 200 with 12 alerts on success; failure HTML with the error reason as an alert | Primary login (NEXA should send the full 12-field payload instead) |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | Get remaining time | `op=getLeftTime`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `logger_id` (note: `_` not `Id`), `username` | Plain text `HH:MM:SS` | Primary time-left endpoint (note the `logger_id` vs `loggerId` key inconsistency — see §8) |
| `https://secure.etecsa.net:8443/LogoutServlet` | POST | Logout | `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId` (note: `Id` not `_` here — inconsistent with `get_time`), `username`, `remove=1` | (response not inspected; `True` returned regardless) | Primary logout |

### 4. Logout flow
- Endpoint: `POST https://secure.etecsa.net:8443/LogoutServlet` with `follow_redirects=True`.
- Parameters: `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId` (concatenated as `self.logger_id + f'{self.username}'` — ⚠️ **missing separator**: produces e.g. `20260622120000000user@nauta.com.cu` with no `+` between them, unlike cnauta's `loggerId+username` format. Likely a bug, but apparently works because ETECSA probably doesn't strictly validate the format), `username`, `remove=1`.
- **Requires prior session info**: YES — needs `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId` from the login step.
- **Crash-recovery variant** `logout_back(ruta)`: reads a JSON file previously written by `save_data(ruta)` and POSTs its contents directly to `/LogoutServlet`. The JSON file contains `ATTRIBUTE_UUID`, `loggerId`, `wlanuserip`, `CSRFHW`, `username`, `password`, `remove=1` — **including the plaintext password**, which is unnecessary for logout (cnauta's logout payload does not include it). This is a security regression.
- **Success detection**: none — `logout()` returns `True` unconditionally as long as the POST does not throw. ⚠️ The implementation does not check the response body for `FAILURE` (unlike cnauta). NEXA must check.

### 5. Balance / time / session info
- **Time remaining** — `get_time()` POSTs to `EtecsaQueryServlet` with `op=getLeftTime`; returns `time.text` (raw plain-text body, `HH:MM:SS`).
- **Balance** — **not implemented**.
- **Connection start time** — not implemented.
- **Account expiration** — not implemented.
- **Strategy**: only structured text parsing for time-left (low fragility); no balance scraping at all.

### 6. Scraping analysis
| Target | Selector / regex | Fragility | Mitigation |
|--------|------------------|-----------|------------|
| CSRFHW, loggerId, wlanuserip | `soup.find('input', {'name': '<name>'}).get('value')` for each | **Low** | Use qvacall-cli's "scrape all inputs in form#formulario" approach instead. |
| Success/failure detection | `re.findall(r'alert\((.*?)\)', text)` then `len(error) == 12` | **Critical** — count-based heuristic | Replace with: `body.match(/<script type="text\/javascript">\s*alert\("([\w ().\p{L}]+)"\);/u)` (qvacall-cli's regex) and treat any non-empty alert match as a structured error; treat absence-of-alert-and-presence-of-ATTRIBUTE_UUID as success. |
| ATTRIBUTE_UUID | `re.findall(r'ATTRIBUTE_UUID=([A-F0-9]+)', text)[1]` (second match) | **Medium** — depends on positional `[1]` | Use first match and validate length ≥ 10; fall back to second match if first is empty. |

### 7. Security review
- **Credential storage**: **plaintext JSON**. `save_data(ruta)` writes `{ATTRIBUTE_UUID, loggerId, wlanuserip, CSRFHW, username, password, remove: 1}` to a user-supplied JSON path. The password is **needlessly** included — logout does not require it.
- **Encryption**: none.
- **Logging of sensitive info**: no `logging` module usage; `print` statements only in error branches of `test_net` (printing exception objects, which might include the URL but not credentials).
- **What NOT to copy**:
  - Including `password` in the `save_data` JSON file.
  - The `len(error) == 12` success heuristic.
  - The missing `+` separator in `loggerId + username` for logout.
  - Returning `True` from `logout()` without inspecting the response body.
  - The stale `pyproject.toml` / `requirements.txt` declaring `requests` while the code uses `httpx`.
- **Best practices to inherit**:
  - Triple-scrape (`CSRFHW` + `loggerId` + `wlanuserip`) from the landing form (more complete than cnauta).
  - The `test_net()` pre-flight pattern (with the caveat that NEXA should probe a non-ETECSA URL too).
  - The `reanude_login()` method: takes the saved JSON, deletes `password` and `remove`, adds `op=getLeftTime`, POSTs to `EtecsaQueryServlet` — recovers time-left without re-authenticating. Useful when the SW restarts but the session is still alive on the ETECSA side.
  - `httpx.Client` (cookie jar automatic) is the architectural analogue of `fetch(..., {credentials: 'include', cookieStoreId})` in a Chromium extension — NEXA should use a dedicated `cookieStoreId` per account to achieve the same isolation.

### 8. Known issues / limitations
- **Dependency mismatch**: `pyproject.toml` declares `requests` + `beautifulsoup4`; code imports `httpx`. `pip install econnect` from the declared manifest would fail at import time. The README correctly mentions `httpx`.
- **`logger_id` vs `loggerId` inconsistency**: `get_time()` sends `logger_id` (underscore) while `logout()` sends `loggerId` (camelCase). One of them is wrong; the code works because ETECSA probably ignores both, but this is a latent footgun.
- **`attribute_uuid = re.findall(...)[1]`** — assumes there are at least 2 matches; raises `IndexError` on a single-match page.
- **`save_data` returns `False` for any exception** with a misleading `print` ("El archivo tiene que ser json…") even when the real failure is, e.g., a permission error.
- **`logout()` swallows all exceptions** via bare `except:` and returns `False`; the caller cannot distinguish network failure from server-side FAILURE.
- **`test_net` is required before `login_net`** because `login_net` reads `self.soup` set by `test_net`. There is no guard — calling `login_net` first raises `AttributeError`.
- **Bare `except:` clauses everywhere** — anti-pattern; hides real bugs.
- **Final source comment**: `# ya funciona wiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii` — indicates solo-author, hobbyist project. Treat as reference, not production-grade.

---

## Repo 8 — `chenryhabana205/qvacall-cli`

**Tagline**: "Pequeña herramienta para conectarse y mantenerse conectado a la red de etecsa desde el pc. Basado en el https://github.com/danielpza/etecsa-cli". A Node.js CLI (installable globally via `npm i -g qvacall-cli`, command `qc`). Forked from `danielpza/etecsa-cli` (not in our research list but explicitly referenced). Closest architectural analogue to NEXA NautaX: it uses a cookie jar (`tough-cookie`) and `cheerio` for HTML parsing — directly translatable to `fetch` + `DOMParser` in a Chromium extension.

### 1. Technology
- **Language**: JavaScript (Node.js, CommonJS).
- **HTTP**: `got ^10.2.2` (Node HTTP client with built-in redirect/cookie support).
- **Cookie jar**: `tough-cookie ^3.0.1` (`CookieJar`) — passed to `got` via the `cookieJar` option.
- **HTML parsing**: `cheerio ^1.0.0-rc.3` (jQuery-like server-side DOM).
- **Form encoding**: `form-data ^3.0.0` (declared but actually unused — `got`'s `form:` option does the encoding).
- **Persistence**: plaintext JSON at `${XDG_CACHE_HOME || $HOME/.cache}/etecsa.json`.
- **Architecture**: three-file split — `src/core.js` (HTTP logic, 113 LOC), `src/index.js` (CLI orchestration + config read/write, 70 LOC), `bin/main.js` / `src/cli.js` (argparse dispatch, ~60 LOC each).
- **Reusable elements for NEXA NautaX**: ⭐ **highest reuse potential of the five repos**. `core.js` is essentially a 113-line reference implementation of the captive-portal flow in JavaScript, using the same primitives a Chromium extension would (`fetch` + cookie jar + DOMParser-equivalent). The `getLoginParameters()` "scrape all form inputs" approach is the most robust CSRF mitigation strategy observed.

### 2. Authentication Flow

**Status pre-check (`status()`)** — used by `logout` and `getTime` to gate on "is the user actually connected?":

```js
const { body } = await got.get(GOOGLE); // http://www.google.com
return !body.match(ETECSA_LOGIN);       // if redirected to secure.etecsa.net:8443 → not connected
```

Clever: GET `http://www.google.com`; if the response body contains `https://secure.etecsa.net:8443` (the captive-portal redirect URL), the user is **not** authenticated; otherwise they are. This is the standard captive-portal detection technique. NEXA should use the same probe (with `http://` deliberately, not `https://`, to ensure the redirect fires before any TLS pinning).

**Pre-login (`getLoginParameters()`)** — the **gold-standard** form-scrape:

```js
const loginResult = await got.get(ETECSA_LOGIN, { cookieJar });
const $ = cheerio.load(loginResult.body);
const result = $("form#formulario")
    .find("input")
    .filter((_, el) => ["button", "reset"].indexOf($(el).attr("type")) === -1)
    .map((_, el) => ({ name: $(el).attr("name"), value: $(el).val() }))
    .get();
const map = {};
for (const { name, value } of result) map[name] = value;
return map;
```

Strategy: select `form#formulario`, take **all** `<input>` children except `type=button|reset`, build a `{name: value}` map. This auto-captures `CSRFHW`, `loggerId`, `wlanuserip`, and any future hidden fields ETECSA adds — **zero hardcoding**. The cookie jar (`cookieJar`) is populated by this GET and reused for the subsequent POST.

**Login (`postLogin()`)**:

| Field | Value |
|-------|-------|
| URL | `https://secure.etecsa.net:8443//LoginServlet` ⚠️ **double slash** (matches cnauta, diverges from econnect) |
| Method | POST |
| Content-Type | `application/x-www-form-urlencoded` (via `got`'s `form:` option) |
| Cookies | automatic via `cookieJar` |
| Headers | none custom (default `got` UA) |
| Follow redirects | `true` |
| Throw on HTTP errors | `true` |
| Body | `{...scrapedParams, username, password}` — i.e. all scraped form fields plus user credentials |

**Success / error detection** (cleanest of the three implementations):

```js
const alertMatch = body.match(
    /<script type="text\/javascript">\s*alert\("([\w ().\p{L}]+)"\);/u
);
if (alertMatch) {
    throw new Error(alertMatch[1]);  // the alert text becomes the error message
}
if (statusCode !== 200) {
    throw new Error(`Server responded with ${statusCode}: ${statusMessage}`);
}
const uuidMatch = body.match(/ATTRIBUTE_UUID=(\w*)&/);
if (!uuidMatch) throw new Error("No uuid in page");
return { uuid: uuidMatch[1], cookies: cookieJar.toJSON(), parameters };
```

Note: `\p{L}` in the alert regex matches any Unicode letter (needed for Spanish accented characters like `ó` in `"incorrectos."`). NEXA should adopt this regex verbatim (with the `u` flag).

**Returned session artifact**:

```js
{
  uuid: "<hex>",                          // ATTRIBUTE_UUID — needed for logout + getLeftTime
  cookies: cookieJar.toJSON(),            // full cookie jar — needed to resume session
  parameters: { CSRFHW, loggerId, wlanuserip, ... } // needed for getTime
}
```

`index.js` writes this entire object into `~/.cache/etecsa.json` alongside the user/pass, so the session survives a process restart.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|-------------------|--------------------|
| `http://www.google.com` | GET | Captive-portal detection | — | If body contains `secure.etecsa.net:8443` ⇒ not authenticated; otherwise authenticated | Use as NEXA's primary "are we connected?" probe (replace with `http://example.com/generate_204` for a lighter check) |
| `https://secure.etecsa.net:8443` | GET | Landing + form scrape + cookie seeding | — | HTML 200 with `<form id="formulario">…</form>` containing CSRFHW, loggerId, wlanuserip, etc. | Mandatory pre-step |
| `https://secure.etecsa.net:8443//LoginServlet` | POST | Login | All scraped form fields + `username` + `password` | Success: HTML with `ATTRIBUTE_UUID=<hex>&`; Failure: HTML with `<script>alert("…")</script>` | Primary login |
| `https://secure.etecsa.net:8443/LogoutServlet` | GET ⚠️ | Logout | URL query: `?ATTRIBUTE_UUID=<uuid>` | Plain text; `success` regex match ⇒ OK; anything else ⇒ error | **Divergent**: qvacall-cli uses GET, cnauta/econnect use POST. NEXA should test both; cnauta's POST form-encoded approach is more widely observed. |
| `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST ⚠️ with query string | Time left | URL query: `?CSRFHW=<csrf>&op=getLeftTime&op1=<username>`; no form body | Plain text `HH:MM:SS` | **Divergent**: qvacall-cli puts everything in the URL query, cnauta/econnect put `op=getLeftTime` in the form body. Both work. NEXA should prefer the form-body approach (matches the dominant pattern). |

### 4. Logout flow
- Endpoint: `GET https://secure.etecsa.net:8443/LogoutServlet?ATTRIBUTE_UUID=<uuid>` ⚠️ (no `username`, no `remove`, no `loggerId`)
- Pre-condition: `status()` must return true (i.e. user must currently be connected). Otherwise throws `"Not connected"`.
- **Does NOT require prior session info beyond the UUID**: just `ATTRIBUTE_UUID`. This is the **most minimal** logout payload of the three implementations — suggesting ETECSA's logout endpoint is permissive about missing fields.
- Success detection: `body.match(/success/i)`. ⚠️ This is the opposite polarity from cnauta (which checks for `FAILURE`). Both work because the success body contains the literal string `success` and the failure body contains `FAILURE`.
- **Crash-recovery**: yes, via `config.cookies` persisted in `~/.cache/etecsa.json` — `cookieJar = CookieJar.fromJSON(config.cookies)` reconstructs the cookie jar without re-authenticating.

### 5. Balance / time / session info
- **Time remaining** — `getTime(username, config)`:

  ```js
  cookieJar = CookieJar.fromJSON(config.cookies);
  const { body } = await got.post(
    ETECSA_TIME + "?CSRFHW=" + config.parameters.CSRFHW + "&op=getLeftTime&op1=" + username,
    { cookieJar }
  );
  return body; // "HH:MM:SS"
  ```

  ⚠️ Note: the CSRFHW is sent in the URL query string here, not in the form body. ETECSA evidently accepts both.
- **Balance** — **not implemented**.
- **Connection start time** — not implemented.
- **Account expiration** — not implemented.
- **Strategy**: plain-text response parsing only (low fragility).

### 6. Scraping analysis
| Target | Selector / regex | Fragility | Mitigation |
|--------|------------------|-----------|------------|
| All login form inputs | `form#formulario input` (excluding `type=button\|reset`) | **Very low** — does not depend on specific input names; auto-adapts to new hidden fields. | None needed; this is the reference strategy. |
| Login error | `/<script type="text\/javascript">\s*alert\("([\w ().\p{L}]+)"\);/u` | **Low** — depends only on the failure-transport mechanism (alert script), not on specific Spanish strings. | NEXA enhancement: maintain a map from alert text → `EtecsaError` code; treat unknown alerts as `UNKNOWN_ERROR` and surface raw text in dev mode. |
| ATTRIBUTE_UUID | `/ATTRIBUTE_UUID=(\w*)&/` | **Low** — the trailing `&` is a robust anchor. | None needed. |
| Connected status | `body.match(ETECSA_LOGIN)` after GET google.com | **Low** — depends only on the captive-portal redirect target URL. | Could also check `response.redirected && response.url.startsWith('https://secure.etecsa.net:8443')` in `fetch` for a header-level (not body-level) detection. |

### 7. Security review
- **Credential storage**: **plaintext JSON** at `${XDG_CACHE_HOME || $HOME/.cache}/etecsa.json`. The file contains:

  ```json
  {
    "user": "<username>",
    "pass": "<plaintext password>",
    "config": {
      "uuid": "<ATTRIBUTE_UUID>",
      "cookies": { /* full tough-cookie jar */ },
      "parameters": { "CSRFHW": "...", "loggerId": "...", "wlanuserip": "..." }
    }
  }
  ```

  ⚠️ Password in plaintext, file permissions not restricted, no encryption.
- **Encryption**: none.
- **Logging of sensitive info**: no `console.log` of credentials; only `console.log("Logged in")`, `console.log("Logged out")`, `console.log("Tiempo restante:", <time>)`. The error path `handleError` prints the error object which may include the request URL (with query string containing CSRFHW if it leaked into the URL — see `getTime`).
- **What NOT to copy**:
  - Plaintext password in `etecsa.json`.
  - The `cookies: cookieJar.toJSON()` persistence — fine for a CLI, but in NEXA the SW should keep cookies in a per-account `cookieStoreId` and never serialise them into `chrome.storage` (the extension's cookie stores are already isolated and persisted by the browser).
  - `cookieJar = CookieJar.fromJSON(config.cookies)` global reassignment — the module-level `cookieJar` is mutated by `getTime`, creating a hidden side-effect between concurrent calls.
  - Hardcoded `http://www.google.com` probe (use `generate_204` endpoints instead).
- **Best practices to inherit**:
  - ⭐ The **"scrape all form inputs"** strategy for `getLoginParameters()` — single most robust CSRF mitigation observed across all 5 repos.
  - The `status()` captive-portal detection via Google GET.
  - The `alert(...)` regex with `\p{L}` for Spanish chars.
  - The structured return type `{ uuid, cookies, parameters }` from `postLogin` — clean contract, directly translatable to a TypeScript `LoginSuccess` branded type.
  - The CLI command surface (`set`, `login`, `logout`, `status`, `time`) is a useful blueprint for NEXA's connector-layer method names.

### 8. Known issues / limitations
- **Logout uses GET, not POST** — diverges from cnauta/econnect. May break if ETECSA tightens HTTP method validation. NEXA should default to POST (matches the dominant pattern) and document GET as a fallback.
- **Logout payload omits `username`, `remove`, `loggerId`** — works today but is fragile.
- **`getTime` puts `CSRFHW` in the URL query** — CSRF tokens in URLs are logged by proxies and browser history; bad practice. NEXA should always send CSRFHW in the form body.
- **`config.parameters` is the full scraped form map** — but `getTime` only reads `config.parameters.CSRFHW`. The other fields are persisted but never reused.
- **No retry/backoff**: `got` will throw on the first network error and the CLI exits with code 1.
- **No auto-reconnect**: the README mentions "realizar la reconexion a las 5 horas" but the code does not implement any scheduling. The author intended to add it ("Mientras se logra agregar al npm…") but never did.
- **`bin/main.js` and `src/cli.js` are near-duplicates** — code duplication; the `bin` entry should `require` `src/cli.js` instead.
- **`var cookieJar = new CookieJar();` at module scope** — global mutable state; concurrent invocations would corrupt each other's cookies.
- **`form-data` dependency declared but never imported** — dead dependency in `package.json`.
- **No `username` validation** — assumes the caller passes a valid Nauta email; no regex check.

---

## Repo 9 — `jvila8512/etecsaApp`

**Tagline**: "controlsuper" — a JHipster-generated monolith. **Not a Nauta captive-portal client.**

### 1. Technology
- **Backend**: Java 21 + Spring Boot 3.x (JHipster 8.11.0 scaffolded), Maven build (`pom.xml` is 56 KB — typical JHipster mega-POM). JWT authentication (`spring-security-oauth2-jose`), Hibernate + EHCache, MySQL (dev/prod), Liquibase migrations, Spring Websocket.
- **Frontend**: React + TypeScript + Redux + React Router + Bootstrap (theme "cerulean"), Webpack. Jest for tests.
- **Domain packages**: `com.etecsa.domain` (`User`, `Authority`, `AbstractAuditingEntity`), `com.etecsa.service.modbus` (`ModBusService`, `GeneradoresWebSocketService`), `com.etecsa.web.rest` (`AuthenticateController`, `GeneradoresController`, `EscrituraModbusController`, `PruebaModbusController`, `UserResource`, …).
- **Industrial protocol**: `com.digitalpetri.modbus` — Modbus TCP client (default port 502). `ModBusService` connects to **electric generators** ("grupo electrógeno") over Modbus and pushes telemetry over WebSocket.
- **Architecture**: standard JHipster monolith — auth via JWT issued by `AuthenticateController.authorize(...)` against the local `User` table; the captive portal at `secure.etecsa.net:8443` is **never referenced anywhere** in the codebase.

### 2. Authentication Flow
- **This is NOT ETECSA Nauta authentication.** It is JWT auth against the app's own backend.
- Endpoint: `POST /api/authenticate` with JSON body `LoginVM { username, password, rememberMe }`.
- Response: `200 OK` with header `Authorization: Bearer <jwt>` and body `{ "id_token": "<jwt>" }`.
- JWT secret is hardcoded in `.yo-rc.json` as a Base64 string (`ZmM4YzUyZmFjZTU5N2M4MGE2ODY2YTg5OTY0MGM2NzExOTA5NDZmZTczNDA2OTExN2MwOWUyYjA3OWIyZWE5YjNkYzM1OTJkYzk4ZTIyZjM3MjhkZDQ3MTY1ODRhMTI1NjYwZTUzNGMxYjBmOTQ0NmU4ZDc1ODE2NTU2ZTY3YWM=`). ⚠️ Security incident if this is a production secret — checked into git.
- No CSRF token, no cookie jar, no `secure.etecsa.net` interaction.

### 3. Endpoints inventory
All endpoints are app-internal, not ETECSA-related:

| URL | Method | Purpose |
|-----|--------|---------|
| `POST /api/authenticate` | POST | Issue JWT for local user |
| `GET /api/authenticate` | GET | Check if currently authenticated |
| `POST /api/users` | POST | Create local user (admin) |
| `GET /api/users` | GET | List local users |
| `* /api/generadores/**` | various | Generator (Modbus) CRUD |
| `* /api/escrituramodbus/**` | various | Modbus write operations |
| `* /api/pruebamodbus/**` | various | Modbus test endpoints |
| `WS /websocket/generadores` | WS | Real-time generator telemetry |

**No ETECSA captive-portal endpoints. No use for NEXA NautaX.**

### 4. Logout flow
- JHipster-default: client-side only — delete the JWT from `localStorage`. No server-side logout endpoint.
- The `GeneradoresWebSocketService` and `UserResource` do not implement session invalidation.

### 5. Balance / time / session info
- **Not applicable.** No Nauta balance, time, or session queries.

### 6. Scraping analysis
- **Not applicable.** No HTML scraping of any external service. The React frontend consumes the local REST API.

### 7. Security review
- ⚠️ **JWT secret hardcoded in `.yo-rc.json` and checked into git.** Anyone with repo read access can forge admin JWTs. This is a JHipster anti-pattern (the generator's secret should be rotated post-scaffold).
- Modbus TCP connections (`connectToGenerator(generatorId, host, port, unitId)`) are unauthenticated at the application layer — relies on network-level isolation.
- `UserService`, `MailService` follow JHipster defaults (bcrypt password hashing, async email).
- **What NOT to copy**: the hardcoded JWT secret. The Modbus write controllers (`EscrituraModbusController`, `PruebaModbusController`) are exposed under `/api/` with only JWT auth — risky if the network is hostile.
- **Best practices to inherit**: none — this repo has no overlap with NEXA NautaX's domain.

### 8. Known issues / limitations
- **Off-topic for NEXA NautaX.** This is an internal ETECSA company tool for supervising electric generators ("grupo electrógeno") via Modbus; the `com.etecsa` package name is the only thing tying it to ETECSA.
- The README is the unmodified JHipster boilerplate (mentions `controlsuper`, `JHipster 8.11.0`, `./mvnw`, `./npmw`, Leaflet, Sonar, Docker Compose) — no ETECSA-specific documentation.
- **Recommendation for NEXA**: skip this repo entirely. Document it as "off-topic / not a Nauta client" and exclude from cross-cutting findings.

---

## Repo 10 — `EtecsaCu/EtecsaNauta`

**Tagline**: README is literally `# Ai_camera` (one line, unrelated — likely a copy-paste error or a deliberate obfuscation). The actual content is a **pre-built React PWA** (only the `dist`/`build` artifacts are committed — no source `.tsx`/`.ts` files). It is the **Nauta user portal** hosted at `https://www.nauta.cu:5002` — NOT the captive portal at `secure.etecsa.net:8443`.

This is the only repo in batch 2 that documents the existence of a **second ETECSA API surface**, distinct from the captive portal. While NEXA NautaX Phase 1 targets only the captive portal (per D09), this repo provides forward-looking intelligence for Phases that may want to query account balance / expiration / history without scraping HTML.

### 1. Technology
- **Frontend**: React 17 (production minified chunks), Redux, React Router, Material-UI, SweetAlert2, react-intl (es/en), moment.js, axios, js-cookie (`me.a` in the bundle = `js-cookies`), crypto-js (SHA512 + Base64).
- **No source code** — only built artifacts:
  - `index.html` (the SPA shell, 4 KB, includes an inline loading fallback and debug `console.log` calls)
  - `main.f9989819.chunk.js` (66 KB — application code)
  - `3.3ef69242.chunk.js` (711 KB — vendor bundle: React, MUI, SweetAlert2, react-intl, redux, moment)
  - `main.7f01d568.chunk.css` (1 KB)
  - `manifest.json` (PWA manifest: `"short_name": "Portal Nauta"`, `"display": "standalone"`, `"theme_color": "#000000"`)
  - `favicon.ico`
- **Architecture**: classic Create-React-App output. The app uses `react-intl` for i18n (es/en), Redux for state, axios for HTTP, js-cookie for token storage, Material-UI for components, SweetAlert2 for dialogs, and `react-idle-timer` for session inactivity detection.
- **Reusable elements for NEXA NautaX**:
  - The **hourly-rotating API-key derivation** (see §2) is a clever pattern that could be reused if NEXA ever needs to call the user-portal API.
  - The i18n keys (`saldo`, `conexion`, `tiempo`, `tranferirSaldo`, etc.) are a useful Spanish/English glossary for NEXA's own UI labels.
  - The error-key taxonomy (`captcha_error`, `login_error`, `error_operacion`, `cuenta_bloqueada`, etc.) is a reference for NEXA's error-message catalogue.

### 2. Authentication Flow

The user-portal auth is **completely different** from the captive-portal auth. It is a custom JWT + rotating-API-key scheme:

**Pre-request header setup** (executed before every axios call once a token is present):

```js
// Pseudocode reconstructed from main.chunk.js
function setAuth(token) {
  if (token) {
    axios.defaults.headers.common.Authorization = "Bearer " + token;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
  const seed = "portal" + moment().format("DDMMyyyyHH") + "externalPortal";
  const apiKey = CryptoJS.SHA512(seed).toString(CryptoJS.enc.Base64);
  axios.defaults.headers.common.usernameApp = "portal";
  axios.defaults.headers.common.passwordApp = "ApiKey " + apiKey;
}
```

So every request carries **three** auth headers:
1. `Authorization: Bearer <jwt>` — the user's session JWT (omitted before login)
2. `usernameApp: portal` — constant string identifying the client
3. `passwordApp: ApiKey <base64(SHA512("portal" + DDMMyyyyHH + "externalPortal"))>` — a rotating API key that changes **hourly**. The seed concatenates the literal `"portal"`, the current timestamp formatted as `DDMMyyyyHH` (e.g. `2206202614` for 2026-06-22 14:xx), and the literal `"externalPortal"`. SHA512-hashed and Base64-encoded.

**Login** (reconstructed from the bundle):
- Endpoint: `POST https://www.nauta.cu:5002/users` (note: `/users`, not `/login` — the same endpoint handles both create-user and authenticate based on whether `email` already exists)
- Body: `{ email, password, captcha }` (inferred from `captcha_error` and `login_error` i18n keys)
- Response (success): `{ resp: { user: { resultado: "OK", services_actualizados: ..., fechaActualizacion: ..., ... } } }`
- Response (failure): `{ resp: { user: { resultado: "ERROR", detalle: "<reason>" } } }`
- On success: the JWT is stored in `localStorage.access_token` (via `js-cookie` — note: the bundle uses `me.a.set("access_token", ...)` which suggests it's actually a **cookie**, not pure localStorage; both `me.a.get` and `localStorage.getItem` are used in different code paths, so the token is mirrored in both)
- The user's email is stored in `localStorage.accessLogin`
- The account type is stored in `localStorage.tipoCuenta`
- ⚠️ **Captcha is required** — `"Código captcha incorrecto"` (`captcha_error`) is one of the failure reasons. This is a hard blocker for NEXA automation of the user portal; the captive portal at `secure.etecsa.net:8443` does not have captcha (per D01), which is why NEXA Phase 1 targets the captive portal.

### 3. Endpoints inventory

| URL | Method | Purpose | Parameters | Expected response | Use in NEXA NautaX |
|-----|--------|---------|------------|-------------------|--------------------|
| `https://www.nauta.cu:5002/users` | POST | Login (and user creation — same endpoint) | `{ email, password, captcha }` + the 3 auth headers | `{ resp: { user: { resultado, detalle, servicios_actualizados, fechaActualizacion } } }` | **Out of Phase 1 scope** (captcha blocks automation). Documented for future Phase expansion. |
| `https://www.nauta.cu:5002/users/logout` | POST | Logout | `{ usuarioPortal: <email> }` + the 3 auth headers | (response not inspected; `.catch(e => e)` swallows errors) | Future Phase |
| `https://www.nauta.cu:5002/service/<serviceId>/id/<profileId>` | GET (inferred from router) | Service detail | path params + auth headers | Service detail JSON | Future Phase (balance / history queries) |
| `https://www.nauta.cu:5002/operation/<id>` | GET (router) | Operation detail | path params + auth headers | Operation detail JSON | Future Phase (connection history) |
| `/login`, `/notfound` | — | Client-side routes | — | — | N/A (SPA routes) |

⚠️ All endpoints require the rotating `passwordApp` header. The hourly rotation means a NEXA extension that wanted to call this API would need to (a) sync the system clock with ETECSA's, (b) re-derive the key on every request, and (c) handle the captcha on login (likely impossible to automate reliably).

### 4. Logout flow
- Endpoint: `POST https://www.nauta.cu:5002/users/logout`
- Body: `{ usuarioPortal: <email> }` (where `<email>` is read from `localStorage.accessLogin`)
- Headers: `Authorization: Bearer <jwt>`, `usernameApp: portal`, `passwordApp: ApiKey <hourly-key>`
- Response handling: `.catch(e => e)` — errors are **swallowed**. After the POST, the client removes `access_token` from cookies/localStorage and redirects to `/login`.
- **Requires prior session info**: YES — needs the JWT (in `access_token`) and the user's email (in `accessLogin`).

### 5. Balance / time / session info
The bundle exposes extensive i18n keys indicating the user portal provides structured (JSON, not HTML-scraped) data for:
- **Saldo disponible** (available balance) — `textSaldoDisponible`, `labelSaldo`, `Saldo principal`
- **Tiempo disponible de la cuenta** (account time available) — `textTiempoDisponibleCuenta`
- **Fecha de bloqueo** (block date) — `Block Date`
- **Fecha de suspensión** (suspension date) — `Suspension Date`
- **Fecha de eliminación** (elimination date) — `Elimination Date`
- **Tipo de cuenta** (account type) — `Account type`
- **Conexiones** (connections history) — `Conexiones`, `Number of Connections`, `Tiempo Total`, `Tráfico Total`, `Subida`, `Descarga`
- **Recargas** (recharges) — `Recargar cuenta`, `Recargar cuenta con cupón`, `Recargar cuenta en Línea`
- **Transferencias** (transfers) — `Transferir saldo`, `Tranferir Saldo`
- **Adelanta Saldo** (advance balance) — `Adelanta Saldo`
- **Pagar cuota / pagar deuda** (pay fee / pay debt) — multiple keys

All of this is returned as **structured JSON** from `nauta.cu:5002` — no HTML scraping. ⭐ This is a **major future opportunity** for NEXA: if the captcha can be solved (e.g. by routing through the user's browser session via `chrome.tabs` and a content script that reads the captcha from the user-portal page), NEXA could offer balance/expiration/history without any HTML scraping at all.

### 6. Scraping analysis
- **Not applicable** — this is a React SPA consuming a JSON REST API. No HTML scraping is performed by the client.

### 7. Security review
- **Token storage**: JWT in `localStorage.access_token` (also mirrored in a cookie via `js-cookie`). ⚠️ `localStorage` is vulnerable to XSS exfiltration; the cookie should at least be `HttpOnly` (it isn't — `js-cookie` cannot set `HttpOnly` cookies, so this is a regular JS-readable cookie).
- **User identifier in localStorage**: `accessLogin` (the email) and `tipoCuenta` (account type) — PII at rest, unencrypted.
- **Rotating API key**: the seed `"portal" + DDMMyyyyHH + "externalPortal"` is **client-side knowledge** — anyone with the bundle can derive the same key. This is obfuscation, not real security. ETECSA presumably relies on it as a soft anti-bot measure layered on top of captcha.
- **Captcha on login**: ⭐ good practice (prevents automated credential stuffing). NEXA cannot automate this; this is the structural reason NEXA Phase 1 stays on the captive-portal surface.
- **Session inactivity timeout**: `react-idle-timer` with `timeout: 60000 * warningTime` (configurable). On idle, the app calls `/users/logout` and redirects to `/login`. Good practice.
- **JWT secret**: not visible in the bundle (server-side only). Good.
- **What NOT to copy**:
  - Storing JWTs in `localStorage` (use `chrome.storage.session` in MV3, which is encrypted at rest by the browser and cleared on browser close).
  - The `passwordApp` header scheme — it's security theater; NEXA should not invent similar "secret" client-side hashes.
  - `.catch(e => e)` error swallowing on logout.
- **Best practices to inherit**:
  - Session inactivity auto-logout with a configurable timeout (NEXA's settings should expose this).
  - Structured error taxonomy (`resultado`/`detalle`) — NEXA's `Result<T, E>` pattern aligns with this.
  - i18n at the key level (not inline strings) — NEXA's themes (D05) should follow the same pattern.

### 8. Known issues / limitations
- **No source code** — only minified build artifacts. Reverse-engineering the exact request/response shapes requires de-obfuscating the webpack modules.
- **README is `# Ai_camera`** — misleading; either a copy-paste error by the repo owner or an attempt to obfuscate the repo's true purpose. The repo's actual content is the Nauta user portal.
- **`https://www.nauta.cu:5002`** — non-standard port (5002); may be blocked by some corporate firewalls.
- **Hardcoded module ID 64** returns the base URL: `var t = "https://www.nauta.cu:5002"` — no environment-based config; changing the backend URL would require rebuilding the bundle.
- **Inline debug `console.log` calls in `index.html`** (e.g. `console.log('🚀 Iniciando Portal Nauta...')`) — production leak.
- **Captcha** blocks headless automation — NEXA cannot use this API for auto-reconnect (D03) without a captcha-solving layer.
- **Hourly API key rotation** means a cached key is valid for at most 1 hour; NEXA would need to re-derive on every request (cheap — SHA512 is fast).
- **Vendor chunk is 711 KB** — bundle size is bloated (SweetAlert2 + MUI + react-intl + moment). Not a NEXA concern, but indicates the user portal is not performance-optimised.

---

## Cross-cutting findings (batch 2)

### A. The two ETECSA API surfaces — confirmed

Batch 2 confirms what batch 1 hinted at: there are **two distinct ETECSA API surfaces**, and conflating them is the #1 source of confusion in the ecosystem:

| Surface | Host | Auth | Captcha | Automation-friendly? | Used by |
|---------|------|------|---------|----------------------|---------|
| **Captive portal** | `secure.etecsa.net:8443` | CSRFHW + cookies + ATTRIBUTE_UUID | No (D01) | ✅ Yes | cnauta, econnect, qvacall-cli (+ all batch-1 repos) |
| **User portal** | `www.nauta.cu:5002` | JWT Bearer + rotating API key | Yes | ❌ No (captcha) | EtecsaCu/EtecsaNauta only |

**NEXA NautaX Phase 1 targets only the captive portal** (per D09: prepaid-only, and the captive portal is the only surface that supports connect/disconnect/time-left without captcha). The user portal is documented here for forward compatibility (e.g. a future "advanced balance" feature that asks the user to solve a captcha in a tab).

### B. The captive-portal contract — consolidated

Across cnauta (Python + C#), econnect, and qvacall-cli, the captive-portal flow is:

```
1. GET https://secure.etecsa.net:8443/
   → captures CSRFHW (form input), loggerId (form input), wlanuserip (form input), session cookies
   → User-Agent MUST be a real browser UA (Firefox 102+ observed)

2. POST https://secure.etecsa.net:8443//LoginServlet   ← double slash, preserved by cnauta & qvacall-cli
   Content-Type: application/x-www-form-urlencoded
   Cookie: <session cookies from step 1>
   Body (12 fields, cnauta's superset):
     wlanacname=, wlanmac=, firsturl=notFound.jsp, ssid=, usertype=,
     gotopage=/nauta_etecsa/LoginURL/mobile_login.jsp,
     successpage=/nauta_etecsa/OnlineURL/mobile_index.jsp,
     loggerId=<from form or synthesised yyyyMMddHHmmssfff>,
     lang=es_ES, username=<user@nauta.com.cu>, password=<plaintext>, CSRFHW=<from form>
   → Success: HTML 200 with `ATTRIBUTE_UUID=<hex>&` embedded in a <script>
   → Failure: HTML 200 with <script>alert("Spanish message")</script>
     Known failure strings (MUST be matched verbatim, including ETECSA's typos):
       "El nombre de usuario o contraseña son incorrectos."
       "No se pudo autorizar al usuario."
       "Usted a realizado muchos intentos."   ← typo preserved
       "Su tarjeta no tiene saldo disponible."
       "El usuario ya está conectado."

3. POST https://secure.etecsa.net:8443/EtecsaQueryServlet   (while connected)
   Body: ATTRIBUTE_UUID=<hex>, wlanacname=, wlanmac=, username=<user>,
         CSRFHW=<from form>, domain=, ssid=, op=getLeftTime,
         loggerId=<id>+<user@nauta.com.cu>
   → Response: plain text "HH:MM:SS" (time remaining)

4. POST https://secure.etecsa.net:8443/LogoutServlet
   Body: username=<user>, ATTRIBUTE_UUID=<hex>, wlanacname=, domain=, remove=1,
         loggerId=<id>+<user@nauta.com.cu>
   → Response: plain text; contains "FAILURE" on failure, "success" on success
   ⚠️ qvacall-cli uses GET ?ATTRIBUTE_UUID=<hex> instead — works but diverges from the dominant pattern
```

### C. CSRF handling — three strategies observed

| Strategy | Used by | Robustness | NEXA recommendation |
|----------|---------|------------|---------------------|
| Scrape only `CSRFHW` from `input[name=CSRFHW]` | cnauta (Python + C#) | Medium — breaks if ETECSA renames the input | Reject |
| Scrape `CSRFHW` + `loggerId` + `wlanuserip` individually | econnect | Medium — breaks if ETECSA renames any of the three | Reject |
| ⭐ Scrape **all** `form#formulario input` (excluding `type=button\|reset`) | qvacall-cli | High — auto-adapts to new hidden fields | **Adopt** (with `DOMParser` in the extension) |

### D. Session-token persistence — universal pattern, flawed execution

All three captive-portal implementations (cnauta, econnect, qvacall-cli) persist `ATTRIBUTE_UUID` + cookies to disk so that logout survives a crash. **All three do it in plaintext** (config.cfg, JSON, etecsa.json). This is the #1 security anti-pattern to avoid.

NEXA must persist the same fields (`ATTRIBUTE_UUID`, `loggerId`, `wlanuserip`, `CSRFHW`, cookies) but **encrypted with the master-password-derived AES key** in `chrome.storage.session` (per D04). The persistence is mandatory — without `ATTRIBUTE_UUID`, logout is impossible and the user's hours keep draining.

### E. The `loggerId` synthesis vs. scrape question

- **cnauta synthesises** `loggerId = DateTime.Now.ToString("yyyyMMddHHmmssfff")` locally.
- **econnect and qvacall-cli scrape** it from the landing form.

Both work today, which means ETECSA does not strictly validate `loggerId` against the CSRFHW issuance. NEXA should **scrape** (qvacall-cli's strategy) because:
1. It's strictly more robust (works whether or not ETECSA validates).
2. It's the same code path as the CSRFHW scrape (no extra logic).
3. It future-proofs against ETECSA tightening validation.

The format on logout is `loggerId+username` (with literal `+`). NEXA must preserve this — cnauta does, econnect has a bug (missing `+`), qvacall-cli omits `loggerId` from logout entirely (works but fragile).

### F. Error detection — three strategies observed

| Strategy | Used by | Robustness | NEXA recommendation |
|----------|---------|------------|---------------------|
| Substring match against 5 hardcoded Spanish strings in the last `<script>` tag | cnauta | High (specific) but brittle (string-copy drift) | Use as a **secondary** check to map alerts → `EtecsaError` codes |
| `len(re.findall(r'alert\((.*?)\)', text)) == 12` count-based heuristic | econnect | **Critical** — breaks if ETECSA adds/removes an alert | **Reject entirely** |
| ⭐ `body.match(/<script type="text\/javascript">\s*alert\("([\w ().\p{L}]+)"\);/u)` and treat any match as an error | qvacall-cli | High — depends only on the alert mechanism, not specific strings | **Adopt** (with the `\p{L}` flag for Spanish accents) |

### G. Logout endpoint — method divergence

- **cnauta + econnect**: `POST /LogoutServlet` with form-encoded body containing `username`, `ATTRIBUTE_UUID`, `remove=1`, `loggerId+username`, `wlanacname=`, `domain=`.
- **qvacall-cli**: `GET /LogoutServlet?ATTRIBUTE_UUID=<hex>` (no other params).

Both work. NEXA should default to the **POST form-encoded** approach (dominant pattern, 2 of 3 implementations) and document the GET variant as a fallback if ETECSA ever changes method handling.

### H. Status / connected-state detection

- **cnauta**: no online status check — relies on local `AreWeConnected` flag in `appconfig.json`.
- **econnect**: `test_net()` GETs `secure.etecsa.net:8443/` and treats `200` as "portal reachable" (not the same as "user connected").
- **qvacall-cli**: ⭐ `status()` GETs `http://www.google.com` and checks if the body contains `secure.etecsa.net:8443` (captive-portal redirect). This is the canonical captive-portal detection technique.

NEXA should adopt qvacall-cli's approach, with the enhancement of using `http://example.com/generate_204` (or `http://connectivitycheck.gstatic.com/generate_204`) and checking for `response.status === 204` (connected) vs. `response.redirected` (captive portal active). This is lighter-weight than fetching Google's HTML.

### I. Balance scraping — fragile but available

Only **cnauta** implements balance scraping (via `EtecsaQueryServlet` POSTed with the login form body, then scraping `table#sessioninfo > tbody > tr > td[1]` for saldo and `[3]` for estado). The scraping is **high-fragility** (positional `<td>` index). NEXA should:
1. Scope the selector to `table#sessioninfo` (Python's approach) rather than global `//td` (C#'s approach).
2. Use a sibling-label regex as a fallback: `Saldo[^0-9]*(\d+(?:\.\d+)?)\s*CUP`.
3. Treat balance scraping as **best-effort** — failure should not block the connect/disconnect flow.

### J. Account expiration — only on the user portal

None of the captive-portal clients (cnauta, econnect, qvacall-cli) can retrieve account expiration dates. That data lives exclusively on the **user portal** at `nauta.cu:5002` (repo 10), which requires captcha. NEXA Phase 1 must therefore document "account expiration" as **not available without user-portal automation** — a known limitation.

### K. Security anti-patterns to avoid (consolidated)

| Anti-pattern | Found in | NEXA mitigation |
|--------------|----------|-----------------|
| Plaintext password in config file | cnauta, econnect, qvacall-cli | AES-GCM encryption with PBKDF2-derived key from master password (D04); key in `chrome.storage.session` |
| Plaintext session tokens (UUID/CSRFHW) in config file | cnauta, econnect, qvacall-cli | Same encryption as passwords; tokens in `chrome.storage.session` (cleared on browser close) |
| Password included in logout payload / crash-recovery file | econnect (`save_data` includes `password`) | Omit password from logout payload (cnauta's pattern); never persist password alongside session tokens |
| CSRF token in URL query string | qvacall-cli (`getTime` puts CSRFHW in URL) | Always send CSRFHW in form body |
| Hardcoded JWT secret in git | jvila8512/etecsaApp | N/A for NEXA (no JWT); if ever needed, generate at install time and store in `chrome.storage.local` |
| `localStorage` for JWT | EtecsaCu/EtecsaNauta | Use `chrome.storage.session` (MV3-encrypted, cleared on browser close) |
| Count-based success heuristic | econnect (`len(error) == 12`) | Use regex-based alert detection (qvacall-cli) |
| Bare `except:` clauses | econnect | Use `Result<T, E>` branded types (Fase 0 restriction) |
| Global mutable cookie jar | qvacall-cli | Use per-account `cookieStoreId` in `chrome.cookies` / `fetch({credentials:'include'})` |

### L. Reusable elements — ranked

1. ⭐⭐⭐ **qvacall-cli `getLoginParameters()`** — "scrape all form#formulario inputs" strategy. Adopt verbatim (with `DOMParser` instead of `cheerio`).
2. ⭐⭐⭐ **qvacall-cli alert regex** with `\p{L}` — adopt verbatim.
3. ⭐⭐⭐ **cnauta `PLoginResult` enum** — adopt as `EtecsaError` branded union (OK / WRONG_PASS / USER_INVALID / MANY_ATTEMPTS / ACCOUNT_OUT_TIME / ALREADY_CONN).
4. ⭐⭐ **cnauta 12-field login payload** — adopt as the canonical form body (superset of all observed variants).
5. ⭐⭐ **cnauta crash-recovery token persistence** — adopt the pattern (persist `ATTRIBUTE_UUID` + `loggerId` + `CSRFHW` + `wlanuserip` + cookies), replace plaintext with AES-GCM encryption.
6. ⭐⭐ **cnauta forced-disconnect-state-clear** after N failed retries — adopt the pattern (avoids "stuck connected" UX).
7. ⭐⭐ **qvacall-cli `status()` captive-portal detection** — adopt (with `generate_204` enhancement).
8. ⭐ **econnect `reanude_login()`** — recover time-left from saved tokens without re-authenticating.
9. ⭐ **econnect triple-scrape** (CSRFHW + loggerId + wlanuserip) — useful as a fallback if the "scrape all inputs" strategy ever fails.
10. ❌ **econnect count-based heuristic** — reject.
11. ❌ **econnect `password` in `save_data`** — reject.
12. ❌ **qvacall-cli GET logout** — reject (use POST).
13. ❌ **qvacall-cli CSRFHW in URL query** — reject.
14. ❌ **EtecsaCu/EtecsaNauta user-portal auth** — defer to a future Phase (captcha blocks automation).
15. ❌ **jvila8512/etecsaApp** — reject entirely (off-topic).

### M. Gaps that batch 2 did NOT resolve (deferred to batch 3)

- No implementation observed does **structured (non-scraped) balance queries** on the captive portal — all rely on `table#sessioninfo` scraping.
- No implementation exposes **connection start time**.
- No implementation handles **concurrent multi-account sessions** (cnauta supports 3 accounts but only one active at a time; econnect and qvacall-cli are single-account).
- No implementation documents ETECSA's **rate-limiting behaviour** (how many login attempts before `MANY_ATTEMPTS`? what's the cooldown?).
- No implementation handles the **"already connected from another device"** scenario gracefully (cnauta maps it to `ALREADY_CONN` but does not auto-resolve).
- No implementation tests **IPv4 vs IPv6** behaviour (`wlanuserip` is scraped — what if ETECSA issues IPv6?).
- These gaps should be addressed in batch 3 (repos 11–15) and in the NEXA connector architecture proposal (Phase 2).
