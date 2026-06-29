# NEXA NautaX — Phase 1 Research Report (Batch 1 of 3)

**Project:** NEXA NautaX (Chromium extension for ETECSA Nauta accounts)
**Batch:** 1 of 3 (repositories 1–5 from the Phase 1 source list)
**Author:** general-purpose research sub-agent
**Date:** 2026-06-22
**Scope:** Reverse-engineering and connector-analysis of 5 GitHub repositories that integrate with ETECSA Nauta services.

> Repositories analyzed:
> 1. `suitetecsa/suitetecsa-sdk-python`
> 2. `mmaciass/nauta-connect`
> 3. `Wachu985/Nauta-Project`
> 4. `stickm4n/stickNAUTA`
> 5. `C-1412/control_center_etecsa`

---

## Repository 1 — `suitetecsa/suitetecsa-sdk-python`

- **URL:** https://github.com/suitetecsa/suitetecsa-sdk-python
- **Default branch:** `master`
- **License:** MIT
- **Author:** Lesly Cintra Laza (`lesclaz95@gmail.com`)
- **Status:** Active-ish; v1.1.0 published on PyPI as `suitetecsa_core`

### 1.1 Technology

| Attribute | Value |
|---|---|
| Language | Python 3 (3.7+) |
| Architecture | Domain-driven, dependency-inverted (abstract `NautaSession` + `NautaScrapper` + concrete `DefaultNautaSession` / `DefaultNautaScrapper`) |
| Layout | `suitetecsa_core/{core,domain,repository,utils}` with `__init__.py` aggregations |
| Dependencies | `requests~=2.34.2`, `beautifulsoup4==4.14.3`, `html5lib`, `netifaces~=0.11.0`, `setuptools` |
| Parser | BeautifulSoup4 with `html5lib` backend (lenient parser) |
| Tests | `tests/test_default_nauta_scrapper.py` with HTML fixtures in `tests/assets/` (useful ground-truth for HTML structure) |
| Two portals | `Portal.CONNECT` (captive portal at `secure.etecsa.net:8443`) and `Portal.USER` (management portal at `www.portal.nauta.cu`) |
| Reusable for NEXA | Architecture (interface + implementation split), full endpoint map, HTML selectors, exception taxonomy, parsers for currency/time/bytes, share-session model (TCP/JSON). NOT reusable directly (Python), but is the most complete reference for translating into TypeScript. |

### 1.2 Authentication flow

The library supports two distinct login flows. **For NEXA NautaX (Nauta prepago captive portal), the relevant flow is `Portal.CONNECT`** — documented below. The `Portal.USER` flow (portal.nauta.cu) is for management operations only.

#### 1.2.1 Captive-portal login (`client.connect()`)

Pre-login CSRF/params fetch (`__connect_session_init`):

1. **GET `http://www.cubadebate.cu/`** (or any external site) — used to detect captive-portal redirect; if response URL contains `secure.etecsa.net` → user is captive and not yet logged in.
2. **GET `https://secure.etecsa.net:8443/`** (initial portal hit). Server returns `landing.html`:
   ```html
   <form name="CMCCWLANFORM" method="post" action="https://secure.etecsa.net:8443">
       <input type="hidden" name="wlanuserip" value="10.190.20.96">
       <input type="hidden" name="wlanparameter" value="546f8eae1194e0ab79c9398c170129ec12734f9518ee324a">
   </form>
   <script>CMCCWLANFORM.submit();</script>
   ```
3. **POST `https://secure.etecsa.net:8443`** with body `wlanuserip`, `wlanparameter`. Server returns `login_page.html` containing `<form id="formulario">` with all hidden inputs.

Login POST (`connect`):

4. **POST `https://secure.etecsa.net:8443//LoginServlet`** *(note: literal double slash)* with form-encoded body containing ALL the inputs harvested from `#formulario` plus credentials:
   - `CSRFHW` (32-hex CSRF token from hidden input)
   - `wlanuserip` (IPv4 of the client behind the captive portal)
   - `wlanacname` (empty in fixture)
   - `wlanmac` (empty)
   - `firsturl` (e.g. `notFound.jsp`)
   - `ssid` (empty)
   - `usertype` (empty)
   - `gotopage` (`/nauta_etecsa/LoginURL/pc_login.jsp`)
   - `successpage` (`/nauta_etecsa/OnlineURL/pc_index.jsp`)
   - `loggerId` (e.g. `20191122040338386`)
   - `lang` (e.g. `es_ES`)
   - `username`
   - `password`

**Headers** (set on the `requests.Session`):
```
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8
Accept-Encoding: gzip, deflate, br
Accept-Language: es-419,es;q=0.6
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

**Cookies:** Server sets a `JSESSIONID` cookie on the first GET (carried automatically by `requests.Session`).

**Success detection:**
- Response URL contains `online.do`
- Response HTML `<script>` block contains the literal: `ATTRIBUTE_UUID=<32-hex>&CSRFHW=<32-hex>&wlanuserip=<ip>&ssid=&loggerId=<digits>+<username>&domain=&username=<username>&wlanacname=&wlanmac=&remove=`
- `ATTRIBUTE_UUID` is extracted via regex: `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='`

**Error detection:** `parse_errors(soup, Portal.CONNECT)` scans the last `<script>` tag of the response for `alert("...")` calls (regex `r'alert\("(?P<reason>[^"]*?)"\)'`).

### 1.3 Endpoints inventory — Portal.CONNECT (captive portal)

| # | URL | Method | Purpose | Body / Params | Response | Use in NEXA |
|---|---|---|---|---|---|---|
| C1 | `http://www.cubadebate.cu/` (or any external) | GET | Detect captive state | — | If response.url contains `secure.etecsa.net` → user is captive | Connectivity probe (offline detection per D07) |
| C2 | `https://secure.etecsa.net:8443/` | GET | First portal hit | — | HTML with `CMCCWLANFORM` form containing `wlanuserip` + `wlanparameter` | Pre-login step 1 |
| C3 | `https://secure.etecsa.net:8443` | POST | Auto-submit `CMCCWLANFORM` to obtain real login form | `wlanuserip`, `wlanparameter` | HTML with `<form id="formulario">` containing `CSRFHW`, `loggerId`, `wlanuserip`, etc. | Pre-login step 2 — CSRF fetch |
| C4 | `https://secure.etecsa.net:8443//LoginServlet` | POST | **LOGIN** | All `#formulario` inputs + `username` + `password` | HTML with inline `<script>` containing `ATTRIBUTE_UUID=...` (success) or `alert("...")` (failure) | Core login |
| C5 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | **Get remaining time** | `op=getLeftTime`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `username` (+ `loggerId` in some impls) | Plain-text `HH:MM:SS` or `errorop` on error | Live countdown (D03 auto-reconnect) |
| C6 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | **Get account info pre-login** (does NOT consume session) | `username`, `password`, `wlanuserip`, `CSRFHW`, `lang` | HTML `<div id="userinfo">` with `<table id="sessioninfo">` and `<table id="sesiontraza">` | Balance + expiration (also useful for `verify()` without consuming quota) |
| C7 | `https://secure.etecsa.net:8443/LogoutServlet` | POST | **LOGOUT** | `CSRFHW`, `username`, `ATTRIBUTE_UUID`, `wlanuserip` (and `loggerId`, `ssid`, `domain`, `wlanacname`, `wlanmac`, `remove=1` in some impls) | Plain text containing `SUCCESS` (or `FAILURE`) | Core logout |
| C8 | `https://secure.etecsa.net:8443/EtecsaQueryServlet?op=getLeftTime&op1=<user>&op2=<sha256>` | POST or GET | AJAX variant of remaining-time call (used by ETECSA's own JS) | `op=getLeftTime`, `op1=<username>`, `op2=<session_hash>` | Plain-text time or `errorop` | Optional alternative path — `op2` derivation unknown |

### 1.3b Endpoints inventory — Portal.USER (`portal.nauta.cu`, NOT directly needed for NEXA Phase 1 but listed for completeness)

| # | URL | Method | Purpose | Body |
|---|---|---|---|---|
| U1 | `https://www.portal.nauta.cu/user/login/es-es` (or `en-en`) | GET | Fetch login form (returns `csrf` token) | — |
| U2 | `https://www.portal.nauta.cu/captcha/?` | GET | Fetch CAPTCHA image bytes | — |
| U3 | `https://www.portal.nauta.cu/user/login/es-es` | POST | Login (requires CAPTCHA) | `csrf`, `login_user`, `password_user`, `captcha` (UPPERCASED), `btn_submit` |
| U4 | `https://www.portal.nauta.cu/useraaa/user_info` | GET | Account info HTML | — |
| U5 | `https://www.portal.nauta.cu/useraaa/recharge_account` | GET then POST | Recharge via code | GET → fetch csrf; POST: `csrf`, `recharge_code`, `btn_submit` |
| U6 | `https://www.portal.nauta.cu/useraaa/transfer_balance` | GET then POST | Transfer balance | `csrf`, `transfer` (e.g. `"25,00"` — comma decimal!), `password_user`, `id_cuenta`, `action=checkdata` |
| U7 | `https://www.portal.nauta.cu/useraaa/change_password` | GET then POST | Change account password | `csrf`, `old_password`, `new_password`, `repeat_new_password`, `btn_submit` |
| U8 | `https://www.portal.nauta.cu/mail/change_password` | GET then POST | Change email password | same as U7 |
| U9 | `https://www.portal.nauta.cu/useraaa/service_detail/{summary,list}/...` | GET/POST | Connection history (paginated) | `csrf`, `year_month=YYYY-MM`, `list_type=service_detail` |
| U10 | `https://www.portal.nauta.cu/useraaa/recharge_detail_...` | — | Recharge history | same pattern |
| U11 | `https://www.portal.nauta.cu/useraaa/transfer_detail_...` | — | Transfer history | same pattern |
| U12 | `https://www.portal.nauta.cu/useraaa/nautahogarpaid_detail_...` | — | Nauta Hogar quote payments | same pattern (Nauta Hogar only) |
| U13 | `https://www.portal.nauta.cu/user/logout` | — | Logout (clears cookies + csrf) | — |

> ⚠️ **Per decision D09 (Phase 1 = prepago only)**, only endpoints C1–C8 above are strictly required. Portal.USER is out of scope but documented for future expansion (Nauta Hogar, history, transfers).

### 1.4 Logout flow

```python
# suitetecsa disconnect()
POST https://secure.etecsa.net:8443/LogoutServlet
     ?CSRFHW=<csrf_hw>&username=<username>&ATTRIBUTE_UUID=<attribute_uuid>&wlanuserip=<wlanuserip>
```
- **Method:** POST (URL params are appended as query string; body is empty)
- **Required prior state:** `username`, `CSRFHW`, `ATTRIBUTE_UUID`, `wlanuserip` — all captured from the login response and held in session.
- **Success condition:** response text contains the literal `SUCCESS` (case-insensitive comparison).
- **Failure:** raises `LogoutException`.
- **Side effects:** ETECSA tears down the session server-side; the JSESSIONID cookie becomes invalid.
- **Notable:** the ETECSA online page (`logged_in.html`) actually performs logout via `XMLHttpRequest.open("GET", "/LogoutServlet?...")` — i.e. **GET also works**. The Python lib uses POST; both methods are accepted by the server.

### 1.5 Balance / time / session info

The library distinguishes two info sources:

**A. Live remaining time (requires active session)** — endpoint C5:
- Returns plain-text `HH:MM:SS` (string).
- Parser: `time_string_to_seconds()` → integer seconds (HH may exceed 23).
- Validator: regex `r'^(\d+):([0-5]\d):([0-5]\d)$'`.

**B. Account snapshot pre-login (endpoint C6, no active internet session needed)**:
- HTML response contains `<div id="userinfo">` with two tables:
  - `<table id="sessioninfo">` rows: Estado de la cuenta, Crédito (`37.82 CUP`), Fecha de expiración, Áreas de acceso.
  - `<table id="sesiontraza">` rows: last sessions (Desde, Hasta, Tiempo).
- Parser (`__get_information_connect`):
  - Selector: `#sessioninfo > tbody > tr > :not(td.key)` → returns the 4 value cells in order.
  - Selector: `#sesiontraza > tbody > tr` → returns last-session rows.
- Currency parser: regex `r'^\$([0-9,]+)(\s[A-Z]+)?$'` then `,` → `.` and float.
- Date parser: `dd/mm/yyyy` format.

**C. Portal.USER account info (endpoint U4)**:
- HTML uses Materialize CSS structure: `div.z-depth-1 > div.m6 > p` cells in order: username, blocking_date, date_of_elimination, account_type, service_type, credit, time, mail_account, (offer, monthly_fee, download_speeds, upload_speeds, phone, link_identifiers, link_status, activation_date, blocking_date_home, date_of_elimination_home, quote_paid, voucher, debt — only if Nauta Hogar).
- The presence of `offer` key triggers `_is_nauta_home = True`.

### 1.6 Scraping analysis

| Element | Selector | Source | Fragility |
|---|---|---|---|
| CSRF token (Portal.USER) | `input[name=csrf]` → `.attrs["value"]` | `csrf_token.html` | **Low** — name attribute is stable |
| CSRFHW (Portal.CONNECT) | `input[name=CSRFHW]` → `.attrs["value"]` | `login_page.html` | **Low** — name attribute is stable |
| `wlanuserip` | `input[name=wlanuserip]` (or `#wlanuserip`) | `login_page.html` | **Low** |
| `loggerId` | `input[name=loggerId]` | `login_page.html` | **Low** |
| All form inputs (generic) | `form_soup.select("input[name]")` → `{name: value}` | both portals | **Low** — generic input harvest |
| ATTRIBUTE_UUID | regex on response HTML: `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` | `logged_in.html` script block | **Medium** — relies on JS string format |
| Error messages (Portal.CONNECT) | regex on last `<script>` tag: `r'alert\("(?P<reason>[^"]*?)"\)'` | error response HTML | **Medium** — depends on `alert("...")` pattern |
| Error messages (Portal.USER) | regex on last `<script>` tag: `r"toastr\.error\('(?P<reason>[^']*?)'\)"` | error response HTML | **Medium** — depends on `toastr.error('...')` pattern; nested HTML parsed via `li.msg_error` and `li.sub-message` |
| Account info (Portal.CONNECT) | `#sessioninfo > tbody > tr > :not(td.key)` | `user_info_connect.html` | **Medium** — relies on table layout |
| Account info (Portal.USER) | `.z-depth-1 > .m6 > p` (positional) | `user_info.html` | **High** — positional, breaks if columns reordered |
| History summary cards | `#content > .card-content`; `.card-stats-number`; `input[name=count]`; `input[name=year_month_selected]` | summary HTML | **Medium** |
| History list rows | `.responsive-table > tbody > tr > td` (positional) | list HTML | **Medium-High** — positional columns |

**Fragility risk profile:** Low for the core login + logout + remaining-time loop (which is all NEXA needs for Phase 1). Medium-High for Portal.USER scraping (out of Phase 1 scope).

**What if ETECSA changes the HTML?** Pre-login CSRF and form fields will still be picked up generically because the code harvests ALL `<input name="...">` from the form (positional independence). The ATTRIBUTE_UUID regex and the error-string pattern would break. Mitigation: implement a "scraper version" constant + structured error reporting (the connector should surface `ScrapingError` to the UI rather than silently failing — aligns with the project's `Result<T,E>` rule).

### 1.7 Security review

- **Credential storage:** The SDK itself does **not persist** credentials — they are passed to `connect()` / `login()` per call. Persistence is delegated to the calling application. ✅ Good.
- **Encryption:** None (the SDK has no encryption module).
- **Sensitive logging:** `logger = logging.getLogger()` at module level; `logger.debug(...)` calls mention URLs but not credentials. ✅ Acceptable.
- **Session sharing utility (`utils/nauta.py: share_session`)**: Spawns a TCP server on `0.0.0.0:8024` and exchanges session data (including `CSRFHW`, `ATTRIBUTE_UUID`, `cookies`) protected by a 4-char secret derived from the last octet of the LAN IP + 4 random chars. **DO NOT replicate this design in NEXA.** The 4-char secret is bruteforceable in seconds; binding it to the LAN IP octet reduces entropy further. ❌ Discard.
- **Session save/load to JSON (`save_data_to_file`)**: Stores `username`, `cookies`, `wlanuserip`, `CSRFHW`, `ATTRIBUTE_UUID` in plaintext JSON. ❌ Don't copy plaintext approach — NEXA must encrypt via the master-password/PBKDF2 scheme (D04).
- **Best practices to inherit:**
  - Strict interface/implementation split (DI). Maps cleanly to TypeScript interfaces.
  - Fine-grained exception taxonomy (`PreLoginException`, `LoginException`, `LogoutException`, `GetInfoException`, `NotLoggedIn`, `RechargeException`, …). Aligns with NEXA's `Result<T,E>` requirement.
  - Generic input harvesting from the form rather than hardcoded names where possible.
  - HTML5lib-style lenient parsing (use `DOMParser` in the SW; for fragile regex extract a `<script>` block first then run regex).
  - The test fixture corpus (`tests/assets/*.html`) is a goldmine for snapshot testing the NEXA connector.

### 1.8 Known issues / limitations

- Two-step pre-login (CMCCWLANFORM auto-submit then `#formulario`) is brittle if ETECSA ever inlines both forms into a single response.
- The double-slash in `https://secure.etecsa.net:8443//LoginServlet` is a documented ETECSA quirk — appears in the actual `form action="..."` attribute. The library respects whatever the form's action attribute says. NEXA must do the same (don't hardcode the path).
- `EtecsaQueryServlet` is overloaded: with `op=getLeftTime` → returns remaining time; with `username+password+CSRFHW+wlanuserip` (no op) → returns account info HTML. Two different contracts on the same endpoint — easy to confuse.
- `parse_errors` only inspects the **last** `<script>` tag. If ETECSA injects a script tag after the error script (e.g. analytics), error detection breaks. NEXA should scan all script tags.
- The `share_session` feature is essentially broken security-wise (see 1.7).
- `convert_to_bytes` uses lowercase unit matching; ETECSA actually returns capitalized units in some pages (`MB` vs `mb`) — minor bug.
- Portal.USER scraping uses positional `.m6` column ordering for NautaUser attributes. If ETECSA reorders the user-info card, the parser silently mis-assigns values. No validation.
- `requirements.txt` pins `requests~=2.34.2` (Python's `requests` does not have a 2.34.2 release — the highest 2.x is 2.32.x). This is an upstream packaging bug indicating the maintainer hasn't tested install on a clean env.

---

## Repository 2 — `mmaciass/nauta-connect`

- **URL:** https://github.com/mmaciass/nauta-connect
- **Default branch:** `master`
- **License:** MIT
- **Version:** 1.4.0 (published on Chrome Web Store: `ppopcmgfgajciikdmipmmpffkpccinep`)
- **Status:** Mature MV2 browser extension; minimal maintenance.

### 2.1 Technology

| Attribute | Value |
|---|---|
| Language | JavaScript (ES6, Babel-compiled) |
| Manifest | `manifest_version: 2` — **must be ported to MV3 for NEXA** |
| Frameworks | React 16.13 + Redux 4 + react-chrome-redux + redux-thunk + Material-UI 4 + Formik + Yup |
| Build | Webpack 4 + Babel 7 + custom `utils/build.js` |
| HTTP client | Native `fetch()` (extension-context) |
| HTML parser | `cheerio@1.0.0-rc.3` (server-side-style DOM in the background page) |
| Crypto | `crypto-js@4.0.0` (AES for credential at-rest encryption), `jsonwebtoken@8.5.1` (purpose unclear from source) |
| Time | `moment@2.29.4` |
| Permissions | `storage`, `notifications`, `https://secure.etecsa.net/*`, `proxy` |
| Architecture | Background page (persistent) + popup + Redux store; actions folder holds all ETECSA interactions |
| Reusable for NEXA | ✅ Yes — this is **the closest reference** to what NEXA is building. Reusable: HTML scraping approach (cheerio), Chrome storage layout, action/reducer pattern, logout URL parameters, login-response parsing. **Must rewrite**: MV2→MV3 migration, React 16→18, Material-UI→NEXA design system, persistent background → service worker, replace `crypto-js` AES-with-hardcoded-key with PBKDF2-derived-key (D04). |

### 2.2 Authentication flow

`loginAction.js` performs:

1. **POST `https://secure.etecsa.net:8443//LoginServlet`** (note double slash).
2. **Headers:**
   ```
   Content-Type: application/x-www-form-urlencoded
   ```
   (No User-Agent override — uses browser default. No CSRF header — only form-encoded body.)
3. **Body** (form-encoded, manually built in `utils/fetch.js:processBody`):
   ```
   username=<urlenc>
   password=<urlenc>
   ```
   ⚠️ **Only `username` and `password` are sent.** No `CSRFHW`, no `wlanuserip`, no `loggerId`. This is suspicious — the official ETECSA form requires these. Two hypotheses:
   - **(H1, likely)** The extension relies on the user's browser having **already been redirected by the captive portal to `https://secure.etecsa.net:8443/`** in a foreground tab, which set the `JSESSIONID` cookie AND primed the session. The POST from the extension then piggybacks on that cookie. `fetch()` in extension context carries cookies for the target origin by default.
   - **(H2)** The login silently fails when CSRFHW is missing and the extension shows a generic "red error" notification; users actually click through to the portal manually first.

   **NEXA recommendation:** DO NOT replicate this shortcut. Always perform the explicit 3-step pre-login (GET `/` → POST `/` with CMCCWLANFORM inputs → POST `//LoginServlet` with full form). This is what repos 1, 3, 4, 5 all do explicitly.
4. **Response parsing** (`utils/htmlWrapper.js`):
   ```javascript
   const $ = cheerio.load(html);
   const data = $('script').get(0).children[0].data;
   const ATTRIBUTE_UUID = data.split('ATTRIBUTE_UUID=')[1].split('&')[0];
   const CSRFHW = cleanRightSide(data.split('&CSRFHW=')[1].split('&')[0]);
   const wlanuserip = cleanRightSide(data.split('&wlanuserip=')[1].split('&')[0]);
   const loggerId = cleanRightSide(data.split('&loggerId=')[1].split('&')[0]);
   const username = cleanRightSide(data.split('&username=')[1].split('&')[0]);
   ```
   (`cleanRightSide` strips trailing `"`, `+`, space — the inline JS string-concatenation noise.)
5. **Error detection:** Inspects HTML for known Spanish error strings (case-sensitive substring match):
   - `Entre el nombre de usuario y contraseña correctos.`
   - `No se pudo autorizar al usuario.`
   - `El nombre de usuario o contraseña son incorrectos.`
   - `El usuario ya está conectado.`
   - `Usted ha realizado muchos intentos.`
   - `Su tarjeta no tiene saldo disponible.`
   - `esta siendo usada`

### 2.3 Endpoints inventory

| # | URL | Method | Purpose | Body | Response | Use in NEXA |
|---|---|---|---|---|---|---|
| M1 | `https://secure.etecsa.net:8443//LoginServlet` | POST | LOGIN | `username`, `password` (⚠️ incomplete — see 2.2) | HTML with `<script>` containing `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId`, `username` | Core login (rewrite with full body) |
| M2 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | Get remaining time | `op=getLeftTime`, `username`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId` | Plain-text `HH:MM:SS` or `errorop` | Live countdown |
| M3 | `https://secure.etecsa.net:8443/LogoutServlet` | POST | LOGOUT | `username`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId` | HTML containing `logoutcallback('SUCCESS')` or `logoutcallback('FAILURE')` | Core logout |

> **Critical gap:** The extension does **NOT** implement the pre-login CSRF fetch or the `CMCCWLANFORM` hop. The extension is therefore partially reliant on out-of-band session priming. This is a significant robustness gap for NEXA.

### 2.4 Logout flow

```javascript
// logoutAction.js
fetchCustom('https://secure.etecsa.net:8443/LogoutServlet', {
  username, ATTRIBUTE_UUID, CSRFHW, wlanuserip, loggerId
});
```
- **Method:** POST (form-encoded).
- **Parameters:** 5 fields (matches the parsed login response). No `remove=1` field (suitetecsa and Wachu985 include it).
- **Success detection:** response text does NOT contain `logoutcallback('FAILURE')`.
- **Requires prior session:** Yes — all 5 fields come from the parsed login response stored in Redux + `chrome.storage.local`.
- **Force logout:** A `forceLogoutAction` dispatches LOGOUT_SUCCESS immediately (UI feedback) and fires the POST in the background. Useful for unreliable connections.
- **Auto logout at zero balance:** `endTimeToLogout` posts logout when time runs out.
- **Session recovery:** `loadSessionFromStorage` reads `chrome.storage.local` and re-hydrates Redux (persists across popup reopens). NEXA's `chrome.storage.local` mirror pattern (Fase 0 decision) is essentially this approach but with an added encryption layer.

### 2.5 Balance / time / session info

- **Remaining time** — endpoint M2, plain-text response.
- **Balance (CUP):** ❌ Not implemented. The extension never queries `EtecsaQueryServlet` with credentials to fetch credit. Users see only remaining time.
- **Account expiration:** ❌ Not implemented.
- **Last connections:** ❌ Not implemented.
- **Session info persisted** (`chrome.storage.local`): `username`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `loggerId`, `lastUpdateTime` (ISO), `lastTimeLeft` (string `HH:MM:SS`).
- **Time update strategy:** Manual + scheduled. The scheduled update runs at midnight on the 1st of every month (`msToNextFirstDate`) — this is wrong logic; the function builds a date in year 2020 (`new Date("2020-...")`) which always produces a negative delta. Effectively the scheduled update never fires; only manual updates work. NEXA should use `chrome.alarms` (per Fase 0 decision) with proper timing logic.

### 2.6 Scraping analysis

- **Target:** The first `<script>` tag in the login-response HTML. The script contains a JavaScript string concatenation that builds a URL with all session params.
- **Strategy:** String splits on `ATTRIBUTE_UUID=`, `&CSRFHW=`, `&wlanuserip=`, `&loggerId=`, `&username=`, with a `cleanRightSide` helper that strips trailing quote/plus/space characters produced by JS concat artifacts.
- **Fragility:** **High.** Any change in the script-string layout (extra whitespace, variable reordering, addition of new params, encoding of `+` as space) breaks the parser. There is no fallback regex and no error reporting beyond a generic "connection error" notification.
- **If ETECSA changes the HTML:** The extension will silently fail to extract `ATTRIBUTE_UUID` → `undefined` → logout will fail → user is stuck connected (consuming time) without UI control. NEXA must use a regex approach (more robust) AND validate that all 5 expected fields are non-empty before reporting login success.

### 2.7 Security review

- **Credential storage (`userStorageAction.js`):**
  ```javascript
  const cipherPassword = CryptoJS.AES.encrypt(password, REACT_APP_KEY_PROTECT).toString();
  chrome.storage.sync.set({ users: [{ username, password: cipherPassword }, ...] });
  ```
  - Stored in `chrome.storage.sync` (synced to user's Google account → travels across devices). For NEXA, `chrome.storage.local` is safer (D04 mandates `chrome.storage.session` for the derived key, `chrome.storage.local` for encrypted blobs — and **not** synced).
  - **AES key is a hardcoded string** in `utils/env.example.js` (`'THE APP PROTECTED KEY HERE'`). The `env.example.js` file is committed; the real `env.js` is supposed to be created per-release but the TODO comment says `sustituir el archivo ".env.example" por ".env" antes de realizar el release`. Hardcoded symmetric key in client code is **zero protection** — anyone with the extension can extract it. ❌ **DO NOT COPY.**
  - **Encryption mode:** CryptoJS AES default is `CBC` with a key-derivation function that hashes the passphrase — but with a static passphrase this is obfuscation, not encryption.
- **Sensitive logging:** `Log.Debug` only fires in `NODE_ENV === 'development'`. Production builds do not log. ✅ Good.
- **Notifications:** Uses `chrome.notifications` (NEXA must NOT use these per D10 — implement NEXA-branded toasts instead).
- **Proxy feature:** `proxy` permission + `proxyAutoAction.js` etc. configures Chrome proxy to a single Montreal server (`192.95.39.46`). This is unrelated to ETECSA functionality; appears to be a leftover/abandoned feature. **Do not inherit.**
- **Public RSA key** in `env.example.js`: 4096-bit RSA public key with no usage in source. Probably leftover from an abandoned client-side encryption scheme. ❌ Discard.
- **Best practices to inherit:**
  - Redux action pattern for triggering async ETECSA operations from popup UI.
  - `chrome.storage.local` as the session-state persistence layer (matches NEXA's SW-efímero rule).
  - `forceLogoutAction` pattern (UI feedback before network confirmation) — useful when ETECSA is slow.
  - `endTimeToLogout` auto-disconnect — matches D03 (auto-reconnect / onZeroBalance) requirements.
  - `loadSessionFromStorage` re-hydration on popup reopen.

### 2.8 Known issues / limitations

- **MV2** — will stop working in Chrome 137+. Must be ported to MV3 (NEXA target).
- **Persistent background page** — incompatible with MV3 service-worker model.
- **Incomplete login body** — relies on out-of-band session priming (see 2.2).
- **`msToNextFirstDate` bug** — produces a date in year 2020; scheduled updates never fire.
- **`crypto-js` AES with hardcoded key** — security theater.
- **`react-chrome-redux`** is deprecated (last release 2017); NEXA should use `chrome.storage.onChanged` (per Fase 0).
- **No multi-account switching in a single session** — `state.login.username` is a single value; multi-account is "remembered credentials" only, not "active session". NEXA needs true session switching (D02).
- **No error-state UI** — errors are surfaced via `chrome.notifications` (forbidden by D10) and a Redux flag; no structured error type or user-actionable recovery.
- **`cheerio` in the browser** — bundle size ~300 KB. NEXA can use `DOMParser` (native) instead.

---

## Repository 3 — `Wachu985/Nauta-Project`

- **URL:** https://github.com/Wachu985/Nauta-Project
- **Default branch:** `main`
- **License:** None (no LICENSE file — code is technically all-rights-reserved; cannot be reused verbatim, but technical findings can be cited)
- **Status:** Single-developer hobby project; contact via Telegram `@Wachu985`

### 3.1 Technology

| Attribute | Value |
|---|---|
| Language | Python 3 |
| Architecture | Monolithic PyQt5 desktop GUI (`views.py` 742 lines, `Conexion.py` 143 lines, `utils.py` 38 lines) |
| Dependencies | `PyQt5==5.15.7`, `requests==2.28.1`, `beautifulsoup4==4.11.1`, `lxml==4.9.1`, `Pillow==9.2.0`, `screeninfo==0.8`, `pyinstaller==5.13` |
| Parser | BeautifulSoup4 with `html.parser` backend |
| Build | PyInstaller → single .exe |
| Reusable for NEXA | ✅ The most thorough list of Spanish error strings. The parameter name list (`PARAMLOGIN`, `VALUES`, `VALUES2`) is a clean reference for what to extract from each phase. The pickle-based credential storage is ❌ NOT to be copied (plaintext). |

### 3.2 Authentication flow

```python
# Conexion.py — login()
# Step 1: GET the portal page
response = self.s.get('https://secure.etecsa.net:8443/', headers=HEADER, timeout=10)
soup = BeautifulSoup(content, 'html.parser')

# Step 2: Build the login form by harvesting ALL hidden inputs from the form
PARAMLOGIN = ['wlanuserip', 'wlanacname', 'wlanmac', 'firsturl',
              'usertype', 'gotopage', 'successpage', 'loggerId', 'CSRFHW']
for f in PARAMLOGIN:
    found, val = self.queryInput(f)  # soup.find_all('input', id=text)
    if found:
        param[f] = val
param['ssid'] = ''
param['lang'] = ''
param['username'] = self.username
param['password'] = self.password

# Step 3: POST the login
response = self.s.post("https://secure.etecsa.net:8443//LoginServlet",
                       data=param, timeout=10)
```

**Headers:**
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36
```
(Only User-Agent is overridden; `requests.Session` defaults supply the rest. No Content-Type override — `requests` sets `application/x-www-form-urlencoded` automatically for dict bodies.)

**Notable:** The library does NOT perform the CMCCWLANFORM pre-step (unlike suitetecsa and repo5). It assumes the GET to `/` directly returns the `#formulario` login form. This may work when the captive portal has already been visited once in the same session, but will fail on a fresh captive redirect. **NEXA must implement the full 3-step flow** (GET → POST CMCCWLANFORM → POST LoginServlet).

**Cookies:** Carried by `requests.Session` automatically.

### 3.3 Endpoints inventory

| # | URL | Method | Purpose | Body | Use in NEXA |
|---|---|---|---|---|---|
| W1 | `https://secure.etecsa.net:8443/` | GET | Fetch login form (CSRFHW + loggerId + wlanuserip) | — | Pre-login |
| W2 | `https://secure.etecsa.net:8443//LoginServlet` | POST | LOGIN | All 9 PARAMLOGIN inputs + ssid, lang, username, password | Core login |
| W3 | `https://secure.etecsa.net:8443//EtecsaQueryServlet` | POST | Get remaining time | `op`, `ATTRIBUTE_UUID`, `CSRFHW`, `wlanuserip`, `ssid`, `loggerId`, `domain`, `username`, `wlanacname`, `wlanmac` | Live countdown |
| W4 | `https://secure.etecsa.net:8443//LogoutServlet` | POST | LOGOUT | Same as W3 + `remove=1` | Core logout |

> The double-slash (`//LoginServlet`, `//EtecsaQueryServlet`, `//LogoutServlet`) is consistent with what ETECSA's own HTML form action specifies. NEXA should respect the form's `action` attribute verbatim rather than hardcoding.

### 3.4 Logout flow

```python
# Conexion.py — logout()
# Parse ATTRIBUTE_UUID/CSRFHW/wlanuserip/loggerId/domain/username/etc from the LAST login response HTML
atri = self.soup.find('script').string
# (string-slice hack to extract 'ATTRIBUTE_UUID=...&CSRFHW=...&wlanuserip=...&...')
payload = { ... extracted values ... }
payload['remove'] = '1'
response = self.s.post("https://secure.etecsa.net:8443//LogoutServlet",
                       data=payload, timeout=10)
if 'SUCCESS' in response.text:
    return True
elif 'FAILURE' in response.text:
    return False
```

- **Method:** POST.
- **Parameters:** 9 fields (matches VALUES2 list) + `remove=1`.
- **Requires prior session:** Yes — the logout payload is parsed from the login-response HTML held in `self.soup` (in-memory). If the app is restarted between login and logout, the payload is lost → logout fails. ❌ This is a critical limitation; NEXA must persist the parsed session fields (encrypted) in `chrome.storage.local`.
- **Success detection:** `'SUCCESS' in response.text` (case-sensitive substring).

### 3.5 Balance / time / session info

- **Remaining time** — endpoint W3. Same plain-text `HH:MM:SS` response.
- **Balance / expiration / last connections:** ❌ Not implemented. Only remaining time is queried.
- **Time-update strategy:** The PyQt5 GUI has a separate `TimeApp` window with its own refresh timer (not visible in the inspected files; the GUI code uses Qt timers).

### 3.6 Scraping analysis

- **Target:** The first `<script>` tag of the login-response HTML (`self.soup.find('script').string`).
- **Strategy:** Pure string slicing:
  ```python
  ini = atri.rfind('op=getLeftTime')
  fin = atri.rfind('g_httpRequest.open("post", "/EtecsaQueryServlet", true);')
  valores = atri[ini:fin].replace('"\r\n            \t\t        \t         ','') \
                          .replace('"\r\n            \t\t                     ','') \
                          .replace('";\r\n\t            ','') \
                          .replace('+ "','').split('&')
  ```
  Then split each `&`-separated value on `=` and zip with a hardcoded key list (`VALUES` for getLeftTime payload, `VALUES2` for logout payload).
- **Fragility:** **Very High.** Depends on exact whitespace/newline patterns in the inline JS source. Any minification, reformatting, or reordering of the script breaks it. Also: `rfind` returns the LAST occurrence — if ETECSA ever duplicates the string, the slice boundaries shift.
- **If ETECSA changes the HTML:** App will silently produce an empty/wrong payload → login "succeeds" but logout always fails → user is stuck connected. No exception is raised.
- **What NEXA can learn:** Use `regex` (more flexible than string-slice) AND validate that all expected keys were captured AND surface a `ScraperError` to the UI on failure.

### 3.7 Security review

- **Credential storage:** Plaintext in `data.pickle`:
  ```python
  Usuarios[self.conbo.currentText()] = self.passw.text()  # raw password
  pickle.dump(Usuarios, pickle_file)
  ```
  The `data.pickle` file sits in the working directory. **Anyone with read access to the file has all stored passwords.** ❌ **NEVER DO THIS.** NEXA must encrypt via PBKDF2-derived key + AES-GCM (D04).
- **`requirements.txt`** declares `bs4==0.0.1` (a dummy wrapper package, not beautifulsoup4) — packaging bug; the real import `from bs4 import BeautifulSoup` works because `beautifulsoup4==4.11.1` is also listed. Minor issue.
- **Sensitive logging:** None.
- **Best practices to inherit:**
  - The complete list of Spanish error strings (8 strings) — the most comprehensive list across all 5 repos. NEXA's `LoginError` taxonomy should map each to a user-actionable message.
  - The `PARAMLOGIN` list as a "must-have" set of hidden inputs to harvest from the form (defensive minimum).

### 3.8 Known issues / limitations

- Login flow skips the `CMCCWLANFORM` redirect step → fails on fresh captive redirects.
- In-memory-only session storage → cannot survive app restart.
- Plaintext credential storage in `data.pickle`.
- No retry / backoff logic.
- No error reporting beyond GUI dialogs (no exception types).
- No tests.

---

## Repository 4 — `stickm4n/stickNAUTA`

- **URL:** https://github.com/stickm4n/stickNAUTA
- **Default branch:** `master`
- **License:** MIT
- **Version:** 2.0.3 (published on PyPI as `stickNAUTA`)
- **Author:** stickM4N (`jcgalindo.jcgh@gmail.com`)

### 4.1 Technology

| Attribute | Value |
|---|---|
| Language | Python 3.7+ |
| Architecture | Two clean classes: `NautaSession` (captive portal) + `PortalNauta` (user portal); context-manager support |
| Dependencies | `lxml`, `requests` (only 2 deps!) |
| Parser | `lxml.html.fromstring` + XPath (faster and stricter than bs4) |
| Reusable for NEXA | ✅ **The cleanest, most idiomatic implementation.** Direct conceptual mapping to TypeScript. Reusable: full endpoint list, session save/load contract, `acquire_user_info` pre-login trick, error-detection regex patterns, validation rules (username suffix `@nauta.com.cu` / `@nauta.co.cu`). |

### 4.2 Authentication flow

```python
# NautaSession.__init__
# Step 1: GET the portal homepage
response = self.__session.get('https://secure.etecsa.net:8443/')

# Step 2: Extract wlanuserip + CSRFHW via XPath from the returned HTML
html_tree = html.fromstring(response.text)
self.__wlanuserip = html_tree.xpath('//*[@id="wlanuserip"]')[0].value
self.__CSRFHW     = html_tree.xpath('//*[@name="CSRFHW"]')[0].value

# Step 3 (optional, acquire_user_info=True): pre-login account info
response = self.__session.post('https://secure.etecsa.net:8443/EtecsaQueryServlet', {
    'username': self.__username,
    'password': self.__password,
    'wlanuserip': self.__wlanuserip,
    'CSRFHW': self.__CSRFHW,
    'lang': 'en_US' or 'es_ES'
})
# Response: HTML with #sessioninfo table → account state, credit, expiration, access_areas
# Response: HTML with #sesiontraza table → last sessions

# Step 4 (login): POST to /LoginServlet
response = self.__session.post('https://secure.etecsa.net:8443/LoginServlet', {
    'username': self.__username,
    'password': self.__password,
    'wlanuserip': self.__wlanuserip,
    'CSRFHW': self.__CSRFHW,
    'lang': self.__language
})
# Success: response.url contains 'online.do'
# Extract ATTRIBUTE_UUID: re.search(r'ATTRIBUTE_UUID=(\w+)&CSRFHW=', response.text)
```

**Headers:** None overridden. `requests.Session` defaults (User-Agent `python-requests/x.y`). The server accepts this UA.

**Cookies:** `JSESSIONID` set automatically on the GET.

**Username validation:** `if not username.endswith(('@nauta.com.cu', '@nauta.co.cu')): raise ValueError`. **Useful guard for NEXA's account-CRUD layer.**

### 4.3 Endpoints inventory — captive portal

| # | URL | Method | Purpose | Body | Response | Use in NEXA |
|---|---|---|---|---|---|---|
| S1 | `https://secure.etecsa.net:8443/` | GET | Fetch CSRFHW + wlanuserip | — | HTML form with `#wlanuserip` + `[name=CSRFHW]` inputs | Pre-login |
| S2 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | **Pre-login account info** (does not consume session) | `username`, `password`, `wlanuserip`, `CSRFHW`, `lang` | HTML with `#sessioninfo` + `#sesiontraza` tables | Balance + expiration + verify-credentials without login |
| S3 | `https://secure.etecsa.net:8443/LoginServlet` | POST | LOGIN | `username`, `password`, `wlanuserip`, `CSRFHW`, `lang` | HTML with inline `<script>` containing `ATTRIBUTE_UUID=...` | Core login |
| S4 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | Remaining time | `op=getLeftTime`, `username`, `wlanuserip`, `CSRFHW`, `ATTRIBUTE_UUID` | Plain-text `HH:MM:SS` | Live countdown |
| S5 | `https://secure.etecsa.net:8443/LogoutServlet?username=...&wlanuserip=...&CSRFHW=...&ATTRIBUTE_UUID=...` | GET | **LOGOUT** (uses GET, not POST) | — (all params in query string) | Plain text containing `SUCCESS` | Core logout |

### 4.4 Logout flow

```python
# NautaSession.logout()
response = self.__session.get(
    f'{self.__nauta_logout_url}?'
    f'username={self.__username}&'
    f'wlanuserip={self.__wlanuserip}&'
    f'CSRFHW={self.__CSRFHW}&'
    f'ATTRIBUTE_UUID={self.__ATTRIBUTE_UUID}'
)
if 'SUCCESS' not in response.text:
    raise RuntimeError(...)
```

- **Method:** **GET** (matches ETECSA's own JS in `logged_in.html`). Other repos use POST — both work, but GET is what the server's own client uses.
- **Parameters:** 4 fields as query string (username, wlanuserip, CSRFHW, ATTRIBUTE_UUID). No `loggerId`, no `remove=1`.
- **Requires prior session:** Yes — needs CSRFHW (from pre-login) + ATTRIBUTE_UUID (from login response) + wlanuserip (from pre-login) + username.
- **Success detection:** `'SUCCESS' in response.text` (case-sensitive).

### 4.5 Balance / time / session info

- **Remaining time** — endpoint S4, plain-text response. Optional `in_seconds=True` returns integer seconds (`hh*3600 + mm*60 + ss`).
- **Account info (pre-login, endpoint S2):**
  - XPath selectors (much more readable than bs4):
    ```
    //*[@id="sessioninfo"]/tbody/tr[1]/td[2]/text()  → account_state (e.g. "Activa")
    //*[@id="sessioninfo"]/tbody/tr[2]/td[2]/text()  → credit (e.g. "37.82 CUP")
    //*[@id="sessioninfo"]/tbody/tr[3]/td[2]/text()  → expiration_date (e.g. "No especificada")
    //*[@id="sessioninfo"]/tbody/tr[4]/td[2]/text()  → access_areas
    //*[@id="sesiontraza"]/tbody/tr/td/text()        → last-sessions cells (flat list, 3 cells per session)
    ```
  - ⚠️ The code does `[0][13:-12]` slicing on the returned text — this trims leading/trailing whitespace baked into the HTML fixture's `<td>` cells. If ETECSA ever changes the cell whitespace, this off-by-N slice will silently produce truncated values. **NEXA should use `.strip()` instead of hardcoded index slicing.**
- **Account data via Portal.USER (PortalNauta class):** Richer — 8 fields including `available_balance` and `remaining_time`. Same Materialize CSS layout as suitetecsa's parser. **Not needed for Phase 1** (D09: prepago only).

### 4.6 Scraping analysis

| Element | Selector | Fragility |
|---|---|---|
| `wlanuserip` | `//*[@id="wlanuserip"]` | **Low** (id-based) |
| `CSRFHW` | `//*[@name="CSRFHW"]` | **Low** (name-based) |
| ATTRIBUTE_UUID | regex `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` | **Medium** |
| Pre-login alert | regex `r'alert\("(?P<_>[^"]*?)"\)'` | **Medium** |
| sessioninfo values | XPath `//*[@id="sessioninfo"]/tbody/tr[N]/td[2]/text()[0][13:-12]` | **High** (hardcoded slice) |
| sesiontraza cells | `//*[@id="sesiontraza"]/tbody/tr/td/text()` (flat list) | **Medium** |
| Portal.USER errors | `r"toastr.error\('<ul><li class=\"msg_error\">(.*)<ul>"` + `r"<li class=\"sub-message\">(.*)</li></ul></li></ul>'"` | **High** (depends on `toastr` HTML structure) |

### 4.7 Security review

- **Credential storage:** The library itself does **not persist** credentials — passed to `__init__`. ✅ Good.
- **Session persistence:** `save_session_data_to_file(file_path)` writes JSON:
  ```json
  { "username": "...", "cookies": {...}, "wlanuserip": "...", "CSRFHW": "...", "ATTRIBUTE_UUID": "..." }
  ```
  Plaintext. The `username` and session tokens are visible. NEXA must encrypt via the master-password-derived key (D04) before persisting.
- **Validation:** Username suffix check (`@nauta.com.cu` / `@nauta.co.cu`) — useful defense-in-depth.
- **Recharge code validation:** `12 <= len(recharge_code) <= 16` and `.isdigit()` — useful input-shape guard for the future recharge feature.
- **Sensitive logging:** None.
- **Best practices to inherit:**
  - Context-manager pattern (`with NautaSession(u, p) as s: ...`) → `__enter__` calls `login()`, `__exit__` calls `logout()`. Maps to TypeScript `using` or a try/finally wrapper in NEXA.
  - The `acquire_user_info=True` flag pattern — NEXA can fetch balance+expiration at the moment of credentials entry (no live internet session needed), which lets users see balance in the dashboard without ever connecting.
  - Session save/load contract (5 required keys: `username`, `cookies`, `wlanuserip`, `CSRFHW`, `ATTRIBUTE_UUID`) — NEXA can use the same shape, encrypted.
  - The 5-key required-keys validator (`required_keys = [...]`).

### 4.8 Known issues / limitations

- The `[0][13:-12]` slice hack for sessioninfo cells is fragile (see 4.6).
- Uses `requests.utils.dict_from_cookiejar` — loses cookie attributes (domain, path, expiry). On restore via `cookiejar_from_dict`, cookies are naked name=value pairs. For NEXA (which uses `fetch()` in the SW and lets the browser manage cookies), this is moot.
- `from ctypes import (Union)` — a wrong import (ctypes.Union is for C unions, not typing.Union). The author meant `typing.Union`. Works because `Union` happens to exist in ctypes, but semantically broken. NEXA: use TS `union` types directly.
- No tests.
- No retry / backoff.

---

## Repository 5 — `C-1412/control_center_etecsa`

- **URL:** https://github.com/C-1412/control_center_etecsa
- **Default branch:** `main`
- **License:** None (only a copyright header `© 2020-2023 Tabares, Inc`); cannot be reused verbatim
- **Author:** César Alejandro Tabares Espinosa
- **Status:** Single-developer Tkinter desktop app; last commit dated 2023.

### 5.1 Technology

| Attribute | Value |
|---|---|
| Language | Python 3 |
| Architecture | Single 1724-line `Interfaz.py` file mixing UI (Tkinter) + business logic + persistence |
| Dependencies | `requests==2.32.3`, `beautifulsoup4==4.12.3`, `psutil==6.0.0`, `ping3==4.0.4`, `tkinter`, `dbm` (stdlib) |
| Parser | `bs4.BeautifulSoup` with `html.parser` backend |
| Persistence | `dbm.dumb` Berkeley-DB-style key-value file (`cards`) for accounts; flat text files for `attribute_uuid`, `logout_url`, `usuario_actual.txt`, `temporizador.txt`; append-only `connections.log` |
| Reusable for NEXA | ✅ Several creative tricks worth inheriting conceptually: (1) **Credentials verification without login** (POST to `EtecsaQueryServlet` with username+password+CSRFHW+wlanuserip returns account info — used to validate credentials at add-time). (2) **Pre-built logout URL persistence** — store the full logout URL so logout works even if the app was restarted without re-parsing login HTML. (3) **Fallback strategy for `getLeftTime`** — try without ATTRIBUTE_UUID first, then with. |

### 5.2 Authentication flow

```python
# Interfaz.py — connect() function (around line 240)

# Step 1: connectivity pre-check (skip if already connected)
session.head("https://www.google.es/", timeout=1, allow_redirects=False)
session.head("https://www.sld.cu/",  timeout=1, allow_redirects=False)

# Step 2: time-left pre-check (skip if zero balance)
if time_left(username) == '00:00:00':
    messagebox.showinfo('Información', 'Su cuenta no dispone de saldo')
    return

# Step 3: GET the portal
r = session.get("https://secure.etecsa.net:8443/", timeout=(2, 1))
soup = bs4.BeautifulSoup(r.text, 'html.parser')

# Step 4: POST the CMCCWLANFORM (action URL is the bare host)
action = 'https://secure.etecsa.net:8443'
form = get_inputs(soup)  # harvests all <input name="..."> from the form
r = session.post(action, form)

# Step 5: Parse the #formulario from the response
soup = bs4.BeautifulSoup(r.text, 'html.parser')
form_soup = soup.find("form", id="formulario")
action = form_soup["action"]  # captures whatever the form action says (e.g. https://secure.etecsa.net:8443//LoginServlet)
form = get_inputs(form_soup)
form['username'] = username
form['password'] = password
csrfhw = form['CSRFHW']
wlanuserip = form['wlanuserip']

# Step 6: POST the actual login
r = session.post(action, form)
attribute_uuid = re.search(r'ATTRIBUTE_UUID=(\w+)&CSRFHW=', r.text).group(1)
```

**Headers:** None overridden. `requests.Session` defaults.

**Cookies:** `JSESSIONID` set automatically on the GET.

This is **the only repo that implements the full 3-step pre-login flow correctly** (CMCCWLANFORM auto-submit + #formulario harvest + LoginServlet POST). NEXA's connector should follow this exact sequence.

### 5.3 Endpoints inventory

| # | URL | Method | Purpose | Body / Params | Response | Use in NEXA |
|---|---|---|---|---|---|---|
| T1 | `https://www.google.es/` | HEAD | Connectivity probe (international) | — | 2xx if online | Connectivity probe (D07 offline detection) |
| T2 | `https://www.sld.cu/` | HEAD | Connectivity probe (national Cuba network) | — | 2xx if on national intranet | National-vs-international detection (out of Phase 1 scope) |
| T3 | `https://secure.etecsa.net:8443/` | GET | First portal hit (CMCCWLANFORM) | — | HTML with `CMCCWLANFORM` form | Pre-login step 1 |
| T4 | `https://secure.etecsa.net:8443` | POST | Auto-submit CMCCWLANFORM | `wlanuserip`, `wlanparameter` | HTML with `#formulario` form | Pre-login step 2 (CSRF fetch) |
| T5 | `<form action>` (typically `https://secure.etecsa.net:8443//LoginServlet`) | POST | LOGIN | All `#formulario` inputs + `username` + `password` | HTML with `ATTRIBUTE_UUID=...` script | Core login |
| T6 | `https://secure.etecsa.net:8443/EtecsaQueryServlet` | POST | **Verify credentials / get expiration (NO LOGIN)** | All `#formulario` inputs + `username` + `password` (no op) | HTML containing "expiración" string | Account verification at add-time (D02 multi-account) |
| T7a | `https://secure.etecsa.net:8443/EtecsaQueryServlet?op=getLeftTime&op1=<username>` | GET | Get remaining time (variant A — without ATTRIBUTE_UUID) | — | Plain-text `HH:MM:SS` | Fallback for remaining-time |
| T7b | `https://secure.etecsa.net:8443/EtecsaQueryServlet?op=getLeftTime&username=<username>&ATTRIBUTE_UUID=<uuid>` | GET | Get remaining time (variant B — with ATTRIBUTE_UUID) | — | Plain-text `HH:MM:SS` | Primary remaining-time (GET variant) |
| T8 | `https://secure.etecsa.net:8443/LogoutServlet?CSRFHW=...&username=...&ATTRIBUTE_UUID=...&wlanuserip=...` | GET | LOGOUT (full URL persisted to file) | — | Plain text containing `SUCCESS` | Core logout |

### 5.4 Logout flow

```python
# Interfaz.py — disconnect() (around line 638)
logout_url = open(LOGOUT_URL_FILE).read().strip()
session = requests.Session()
for error_count in range(10):  # retry up to 10 times
    try:
        r = session.get(logout_url)
        break
    except requests.RequestException:
        continue
if 'SUCCESS' in r.text:
    os.remove(LOGOUT_URL_FILE)
```

- **Method:** GET (matches stickNAUTA and ETECSA's own JS).
- **Parameters:** 4 query-string fields (`CSRFHW`, `username`, `ATTRIBUTE_UUID`, `wlanuserip`) — same as stickNAUTA.
- **Pre-built URL:** The logout URL is composed immediately after login and written to a plaintext file (`LOGOUT_URL_FILE`). This decouples logout from the login HTML — even if the app is restarted, the logout URL is still valid (until the ETECSA session expires server-side).
- **Retry:** Up to 10 attempts on `RequestException` — useful for flaky networks.
- **Requires prior session:** Yes — needs the persisted logout URL (which encodes CSRFHW + ATTRIBUTE_UUID + wlanuserip + username).
- **"Guessed" logout URL:** The app even tries to **predict** the logout URL *before* login by reading the last-known `attribute_uuid` from a file (`ATTR_UUID_FILE`) and composing a logout URL with the new CSRFHW/wlanuserip. If the actual ATTRIBUTE_UUID matches the guessed one (which happens when the same user re-logs in within the same ETECSA session window), the guessed URL is valid. This is creative but fragile; NEXA should not replicate this guesswork.

### 5.5 Balance / time / session info

- **Remaining time** — endpoint T7a/T7b, GET variant. The fallback chain (try without ATTRIBUTE_UUID first, then with) is interesting:
  ```python
  # Variant A — assumes the server tracks session by username+JSESSIONID only
  r = session.get("...?op=getLeftTime&op1={}".format(username))
  # Variant B — full session identification
  r = session.get("...?op=getLeftTime&username={}&ATTRIBUTE_UUID={}".format(username, attribute_uuid))
  ```
  ⚠️ **Note:** Variant A uses `op1=<username>` while Variant B uses `username=<username>`. The naming difference (`op1` vs `username`) is observed in ETECSA's own `logged_in.html` JS: `g_httpRequest.open("post", "/EtecsaQueryServlet?CSRFHW=...&op=getLeftTime&op1=rrtoledo@nauta.com.cu&op2=EF7E5B1878C624B2F633A8268D5A329635EBC15876B9EDE7645FAB578590B525", true);`. The `op2` is a 64-char hex string (looks like SHA-256) — derivation unknown (possibly derived from `ATTRIBUTE_UUID` or `loggerId`). NEXA should prefer the **POST form-encoded variant** (used by suitetecsa/mmaciass/Wachu985/stickNAUTA) over the GET query-string variant, because the POST variant doesn't require `op2`.
- **Balance:** ❌ Not displayed in the UI. (The `fetch_expire_date` function could be extended to parse credit from the same `#sessioninfo` table — the HTML structure supports it — but the code only extracts the expiration date.)
- **Expiration date** — endpoint T6 (`fetch_expire_date`):
  ```python
  soup = bs4.BeautifulSoup(r.text, 'html.parser')
  exp_node = soup.find(string=re.compile("expiración"))
  exp_text = exp_node.parent.find_next_sibling('td').text.strip()
  ```
  - **Fragility:** Medium. Depends on the Spanish word "expiración" being present; the `find_next_sibling('td')` assumes a specific table layout. If ETECSA changes the label or restructures the table, returns `"**invalid credentials**"`.
- **Account state / last sessions:** ❌ Not extracted (HTML contains them but code only reads expiration).
- **Cached time-left:** Uses `dbm` to cache `time_left` per username with a `last_update` timestamp; refreshes if older than 60 seconds. NEXA can mirror this in `chrome.storage.local` with a TTL.

### 5.6 Scraping analysis

| Element | Selector | Fragility |
|---|---|---|
| Form inputs (all) | `form_soup.find_all("input")` → `{name: value}` (skip inputs without `name`) | **Low** (generic) |
| `#formulario` form | `soup.find("form", id="formulario")` | **Low** (id-based) |
| ATTRIBUTE_UUID | regex `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` | **Medium** |
| Expiration date | `soup.find(string=re.compile("expiración"))` → `.parent.find_next_sibling('td').text` | **Medium-High** (depends on label text) |
| Account state (in `#sessioninfo`) | (available in HTML but not parsed) | — |

### 5.7 Security review

- **Credential storage:** Plaintext in `dbm` file (`cards`):
  ```python
  cards_db[username] = json.dumps({'password': password, ...})
  ```
  The `cards` file sits in the working directory. **Anyone with read access has all stored passwords.** ❌ **NEVER DO THIS.**
- **ATTRIBUTE_UUID persistence:** Written to a plaintext file `attribute_uuid`. This is effectively a **session token** — anyone with the file can hijack the live session (force-logout the legitimate user). ❌ Encrypt at rest.
- **Logout URL persistence:** Written to a plaintext file `logout_url`. Contains CSRFHW + ATTRIBUTE_UUID. Same risk as above.
- **Logging:** Append-only `connections.log` with timestamps + username + time-left. Does NOT log passwords. ✅ Acceptable, but logs should be rotated.
- **Sensitive `print` calls:** `print("Cargando")` etc. — debug noise, no secrets.
- **Best practices to inherit:**
  - **Credentials verification at add-time** (T6 endpoint) — NEXA's "Add Account" form can POST to `EtecsaQueryServlet` with username+password+CSRFHW+wlanuserip to validate credentials WITHOUT establishing a live internet session. This lets the user confirm the account is valid before saving it. ✅ Strong UX win.
  - **Pre-built logout URL persistence** — NEXA can store the full logout URL (encrypted) in `chrome.storage.local` so logout works even after a SW restart.
  - **Retry loop on logout** (10 attempts) — robust against transient network errors.
  - **Cached time-left with TTL** — NEXA can cache `lastTimeLeft` + `lastUpdateTime` in `chrome.storage.local` and show a "stale" indicator if the cache is older than N seconds.
  - **Two connectivity probes** (international + national) — NEXA can do the same to distinguish "no internet at all" from "captive but not logged in" (D07 offline handling).

### 5.8 Known issues / limitations

- Single 1724-line file mixes UI, business logic, persistence — unmaintainable.
- Plaintext credential storage in `dbm` (see 5.7).
- The `op1=<username>` (no ATTRIBUTE_UUID) variant of `getLeftTime` is unreliable — server often returns `errorop` without proper session identification. The fallback chain sometimes returns the wrong account's time if multiple users share a JSESSIONID.
- `time_left()` swallows all exceptions and shows a generic "no se puedo acceder" message — no structured error type.
- The `verify()` function (endpoint T6) calls the same `EtecsaQueryServlet` endpoint as `fetch_expire_date` but only checks for presence of "expiración" — returns boolean. Could be unified.
- `select_card()` picks the account with the **lowest** time-left to auto-connect — interesting strategy for multi-account users, but assumes all stored accounts are valid (no expiry check).
- The "guessed logout URL" pre-login is brittle.
- No tests.

---

## Cross-cutting findings

### A. The canonical ETECSA captive-portal flow (consensus across all 5 repos)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Connectivity probe                                                        │
│    HEAD https://www.google.es/ (or any external) → 2xx = already online      │
│    HEAD https://www.sld.cu/   (national Cuba) → 2xx = on national intranet   │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. GET https://secure.etecsa.net:8443/                                       │
│    Returns HTML with <form name="CMCCWLANFORM" action="https://...8443">     │
│    containing hidden inputs: wlanuserip, wlanparameter                       │
│    Server also sets JSESSIONID cookie                                        │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. POST https://secure.etecsa.net:8443                                       │
│    Body: wlanuserip, wlanparameter                                           │
│    Returns HTML with <form id="formulario" action="...//LoginServlet">       │
│    containing hidden inputs: wlanuserip, wlanacname, wlanmac, firsturl,      │
│    ssid, usertype, gotopage, successpage, loggerId, lang, CSRFHW             │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 4. POST <form action>   (typically https://secure.etecsa.net:8443//LoginServ │
│    Body: ALL harvested hidden inputs + username + password                   │
│    Success: response.url contains "online.do"                                │
│             response HTML <script> contains:                                 │
│               ATTRIBUTE_UUID=<32-hex>&CSRFHW=<32-hex>&wlanuserip=<ip>        │
│               &ssid=&loggerId=<digits>+<username>&domain=&username=<username>│
│               &wlanacname=&wlanmac=&remove=                                  │
│    Failure: response HTML <script> contains alert("<Spanish error msg>")     │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. Live polling (every 60s recommended):                                     │
│    POST https://secure.etecsa.net:8443/EtecsaQueryServlet                    │
│    Body: op=getLeftTime, username, ATTRIBUTE_UUID, CSRFHW, wlanuserip,       │
│          loggerId                                                             │
│    Returns: plain text "HH:MM:SS"  OR  "errorop"                             │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 6. LOGOUT (GET or POST both work):                                           │
│    https://secure.etecsa.net:8443/LogoutServlet                              │
│      ?CSRFHW=<csrf>&username=<user>&ATTRIBUTE_UUID=<uuid>&wlanuserip=<ip>    │
│    Body (if POST): same fields + remove=1 (+ loggerId, ssid, domain,         │
│                    wlanacname, wlanmac in some impls)                         │
│    Returns: plain text containing "SUCCESS" (or "FAILURE")                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**NEXA MUST implement steps 1–4 + 6 verbatim** (5 is the polling loop). Skipping step 3 (CMCCWLANFORM auto-submit) — as mmaciass and Wachu985 do — results in intermittent failures on fresh captive redirects.

### B. Endpoint comparison matrix

| Endpoint | suitetecsa | mmaciass | Wachu985 | stickNAUTA | C-1412 |
|---|---|---|---|---|---|
| Pre-login GET `/` | ✅ (via cubadebate redirect) | ❌ skip | ✅ | ✅ | ✅ |
| CMCCWLANFORM POST `/` | ✅ | ❌ skip | ❌ skip | ❌ skip | ✅ |
| `#formulario` parse | ✅ | ❌ skip | ✅ (but assumes direct return) | ✅ (XPath) | ✅ |
| Login POST `/LoginServlet` | ✅ (full body) | ⚠️ (only user+pass) | ✅ (full body) | ✅ (full body minus loggerId) | ✅ (full body) |
| ATTRIBUTE_UUID regex | `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` | string-split | string-split | `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` | `r'ATTRIBUTE_UUID=(\w+)&CSRFHW='` |
| `EtecsaQueryServlet` for remaining time | POST | POST | POST | POST | GET (with fallback chain) |
| `EtecsaQueryServlet` for pre-login account info | POST (with creds) | ❌ | ❌ | POST (with creds) | POST (with creds) — `verify()` + `fetch_expire_date()` |
| Logout method | POST | POST | POST (`remove=1`) | GET | GET |
| Logout params | 4 + extras | 5 (incl. loggerId) | 9 + `remove=1` | 4 | 4 |

### C. CSRF token handling summary

- **Portal.CONNECT (`secure.etecsa.net:8443`) uses `CSRFHW`** — a 32-hex-char token issued in a hidden `<input name="CSRFHW">` of the `#formulario`. Fetched fresh on every pre-login. Must be sent back in EVERY subsequent request (login, query, logout). It is **NOT** a cookie — it's a form field. Treat it as a session-scoped secret.
- **Portal.USER (`portal.nauta.cu`) uses `csrf`** — a string token (e.g. `security6416bea61ad2b`) issued in `<input name="csrf">` of the login form. Different name, different format. Must be re-fetched for every action (recharge, transfer, change_password, history summary).
- **NEXA Phase 1 only needs `CSRFHW`** (Portal.CONNECT). The Portal.USER `csrf` is for future expansion (out of Phase 1 scope per D09).

### D. Spanish error string catalog (consolidated from all 5 repos)

These are the exact strings ETECSA injects into `<script>alert("...")</script>` or `<script>toastr.error('...')</script>` blocks. NEXA's `LoginError` taxonomy should map each to a user-actionable message:

| Spanish string (case-sensitive substring) | Meaning | NEXA error code suggestion |
|---|---|---|
| `Entre el nombre de usuario y contraseña correctos.` | Wrong username or password | `InvalidCredentials` |
| `No se pudo autorizar al usuario.` | Authorization failed (bad creds) | `InvalidCredentials` |
| `El nombre de usuario o contraseña son incorrectos` | Wrong username or password | `InvalidCredentials` |
| `El usuario ya está conectado.` | Account already has an active session elsewhere | `AccountInUse` |
| `Usted ha realizado muchos intentos.` | Rate-limited (too many attempts) | `RateLimited` |
| `Su tarjeta no tiene saldo disponible.` | Zero balance | `ZeroBalance` (maps to D03 onZeroBalance) |
| `El saldo de su cuenta es insuficiente, recargue su cuenta en intentelo de nuevo` | Insufficient balance | `ZeroBalance` |
| `Su estado de cuenta es anormal` | Account state abnormal (blocked?) | `AccountBlocked` |
| `esta siendo usada` | Account currently in use | `AccountInUse` |
| `errorop` (response from EtecsaQueryServlet) | Session expired or invalid op | `SessionExpired` |

### E. Credential storage approaches (and what NEXA must do instead)

| Repo | Storage | Encryption | Verdict |
|---|---|---|---|
| suitetecsa | (none — caller's responsibility) | — | ✅ Safe (caller decides) |
| mmaciass | `chrome.storage.sync` (synced to Google!) | AES with hardcoded key | ❌ Hardcoded key = no protection; sync = exfiltration risk |
| Wachu985 | `data.pickle` in working dir | None (plaintext) | ❌❌ Critical |
| stickNAUTA | (none — caller's responsibility) | — | ✅ Safe |
| C-1412 | `dbm` Berkeley-DB file in working dir | None (plaintext) | ❌❌ Critical |

**NEXA mandate (per D04):**
- Credentials: AES-GCM encrypted with PBKDF2-derived key from master password.
- Derived key: lives in `chrome.storage.session` (survives SW restarts, lost on browser close).
- Encrypted blobs: live in `chrome.storage.local` (NOT synced).
- NEVER use `chrome.storage.sync` for credentials or session tokens.

### F. Session-persistence shape (consensus)

All repos that persist session data converge on roughly the same shape:

```typescript
interface EtecsaSession {
  username: string;          // email@nauta.com.cu or @nauta.co.cu
  wlanuserip: string;        // IPv4 captured from #formulario
  CSRFHW: string;            // 32-hex token captured from #formulario
  ATTRIBUTE_UUID: string;    // 32-hex token captured from login-response <script>
  loggerId?: string;         // optional, captured from login-response <script>
  cookies?: Record<string, string>;  // for python-requests-style persistence; NEXA can omit (browser manages)
}
```

Plus NEXA-specific runtime fields (unencrypted, in `chrome.storage.local`):
- `lastUpdateTime: number` (epoch ms of last successful poll)
- `lastTimeLeft: string` (cached `HH:MM:SS`)
- `loginAt: number` (epoch ms of login — for "connected for X minutes" display)

### G. HTML scraping fragility ranking (low → high)

1. **Low fragility** — Generic `<input name="...">` harvesting (suitetecsa, C-1412). Captures CSRFHW, wlanuserip, loggerId by name attribute, agnostic to form layout.
2. **Low fragility** — `<form id="formulario">` lookup (C-1412, suitetecsa). ID-based.
3. **Medium fragility** — `ATTRIBUTE_UUID=(\w+)&CSRFHW=` regex on login-response script (suitetecsa, stickNAUTA, C-1412). Works as long as the script-string format is preserved.
4. **Medium fragility** — `alert("...")` / `toastr.error('...')` regex for error parsing. Depends on ETECSA's JS error-reporting pattern.
5. **High fragility** — `#sessioninfo > tbody > tr[N] > td[2]` XPath + hardcoded `[13:-12]` slice (stickNAUTA). Depends on exact whitespace.
6. **High fragility** — Positional `.z-depth-1 > .m6 > p` cell mapping for NautaUser (suitetecsa Portal.USER parser).
7. **Very high fragility** — String-slice with hardcoded newline/whitespace replacements (Wachu985). Breaks on any reformatting.
8. **Very high fragility** — `$('script').get(0).children[0].data` cheerio split (mmaciass). Assumes the first script tag is the session-script; breaks if ETECSA injects any other script first (analytics, etc.).

**NEXA strategy:** Use approach #1 (generic input harvest) + approach #3 (regex for ATTRIBUTE_UUID). Add a "scraper version" constant and structured `ScraperError` so that future ETECSA HTML changes produce an actionable error message in the UI rather than silent corruption.

### H. Reusable patterns to inherit in NEXA (consolidated)

| Pattern | Source repo(s) | NEXA application |
|---|---|---|
| Interface/implementation split (DI) | suitetecsa | ETECSA connector interface + concrete class |
| Fine-grained exception taxonomy | suitetecsa | `Result<T, EtecsaError>` discriminated union |
| Generic `<input name>` harvesting | suitetecsa, C-1412 | Pre-login CSRF fetch |
| CMCCWLANFORM auto-submit | suitetecsa, C-1412 | Required pre-login step |
| Regex `ATTRIBUTE_UUID=(\w+)&CSRFHW=` | suitetecsa, stickNAUTA, C-1412 | Login-response parsing |
| Credentials verification without login (`EtecsaQueryServlet` with creds) | stickNAUTA, C-1412 | "Add Account" form validation (D02 multi-account) |
| Pre-built logout URL persistence | C-1412 | Logout survives SW restart |
| Logout retry loop (10x) | C-1412 | Robustness on flaky networks |
| Cached time-left with TTL (60s) | C-1412 | Reduce polling traffic |
| Two connectivity probes (international + national) | C-1412 | D07 offline detection |
| Force-logout (UI feedback before network) | mmaciass | UX pattern for slow networks |
| Auto-logout at zero balance | mmaciass | D03 onZeroBalance |
| Session-data save/load contract (5 required keys) | stickNAUTA, suitetecsa | Encrypted session persistence |
| Context-manager pattern (login/logout bracket) | stickNAUTA | `try { connector.login() ... } finally { connector.logout() }` |
| Username suffix validation (`@nauta.com.cu` / `@nauta.co.cu`) | stickNAUTA | Account-CRUD input validation |
| Spanish error string catalog | Wachu985 (most complete) | `LoginError` message mapping |
| HTML fixture corpus for tests | suitetecsa | Snapshot tests for NEXA connector |

### I. Anti-patterns to AVOID in NEXA (consolidated)

| Anti-pattern | Source repo(s) | Why avoid |
|---|---|---|
| Plaintext credential storage in local file (`pickle`, `dbm`) | Wachu985, C-1412 | Anyone with file read access has all passwords |
| AES with hardcoded key (security theater) | mmaciass | Equivalent to no encryption; key extractable from extension bundle |
| `chrome.storage.sync` for credentials | mmaciass | Synced to Google account → cross-device exfiltration risk |
| Storing `ATTRIBUTE_UUID` in plaintext file | C-1412 | Effectively a session token; can be used to force-logout the legitimate user |
| Skipping the CMCCWLANFORM pre-login step | mmaciass, Wachu985 | Intermittent failures on fresh captive redirects |
| Sending login POST with only username+password (no CSRFHW) | mmaciass | Relies on out-of-band session priming; brittle |
| `chrome.notifications` for user feedback | mmaciass | Forbidden by D10 (use NEXA-branded toasts) |
| Persistent background page (MV2) | mmaciass | Incompatible with MV3 (NEXA target) |
| `setInterval` for scheduled updates | mmaciass (broken `msToNextFirstDate`) | Use `chrome.alarms` per Fase 0 decision |
| `react-chrome-redux` | mmaciass | Deprecated; use `chrome.storage.onChanged` per Fase 0 |
| `cheerio` in browser extension | mmaciass | 300 KB bundle; use native `DOMParser` |
| String-slice parsing of inline JS (hardcoded whitespace) | Wachu985, mmaciass | Breaks on any reformatting |
| Hardcoded `[13:-12]` slice for table cells | stickNAUTA | Breaks on whitespace change; use `.strip()` |
| TCP server on `0.0.0.0:8024` with 4-char secret | suitetecsa (`share_session`) | Bruteforceable in seconds; do not replicate |
| Throwing exceptions in connector layer | all (Python) | NEXA mandates `Result<T,E>` (no throws) |
| Mixing UI code with business logic | C-1412 (single 1724-line file) | Unmaintainable |

### J. Open questions for Phase 2 (Architecture)

1. **`op2` parameter in EtecsaQueryServlet GET variant** — observed in ETECSA's own JS (`op2=EF7E5B1878C624B2F633A8268D5A329635EBC15876B9EDE7645FAB578590B525`, 64-hex). None of the 5 repos derive it. NEXA can sidestep by using the POST form-encoded variant (no `op2` needed), but understanding `op2` would unlock the GET variant as a fallback.
2. **Session lifetime server-side** — How long does ETECSA keep a logged-in session alive without traffic? Affects the auto-reconnect backoff strategy (D03). Need empirical testing.
3. **Rate-limit threshold** — `Usted ha realizado muchos intentos.` — what's the exact threshold and cooldown? Affects login-retry logic.
4. **`online.do` URL format** — `http://secure.etecsa.net:8443/online.do?...` — what query params does it carry? Affects success detection robustness.
5. **Captive-portal redirect detection** — Is there a reliable user-agent-agnostic way to detect the captive state? `http://www.cubadebate.cu/` works but is Cuba-specific; `http://neverssl.com/` or `http://generate_204` are international alternatives.

### K. Confidence assessment

| Finding | Confidence | Basis |
|---|---|---|
| Captive-portal endpoint URLs (`/`, `/LoginServlet`, `/EtecsaQueryServlet`, `/LogoutServlet`) | **Very High** | Confirmed by all 5 repos + HTML fixtures in suitetecsa tests |
| `CSRFHW` is a hidden form input (not a cookie/header) | **Very High** | Confirmed by HTML fixtures |
| `ATTRIBUTE_UUID` is parsed from login-response `<script>` via regex | **Very High** | 3 of 5 repos use the same regex; matches HTML fixture |
| Full pre-login 3-step flow (CMCCWLANFORM → #formulario → LoginServlet) | **High** | Confirmed by suitetecsa + C-1412 (the two most thorough repos); fixtures prove the intermediate HTML exists |
| Logout works via both GET and POST | **High** | stickNAUTA + C-1412 use GET; suitetecsa + Wachu985 + mmaciass use POST; both succeed based on ETECSA's own JS using GET |
| Spanish error strings | **High** | Wachu985 has the most complete list; mmaciass confirms 7 of them; suitetecsa confirms the regex pattern |
| `EtecsaQueryServlet` pre-login account-info trick (T6 / S2) | **Medium-High** | stickNAUTA + C-1412 both implement it; HTML fixture confirms `#sessioninfo` table appears in that response |
| `op2` derivation | **Low** | No repo derives it; observed only in ETECSA's own JS |
| Rate-limit thresholds | **Low** | No repo documents the threshold |

---

*End of Batch 1 research report. Batches 2 and 3 will cover repositories 6–15 from the Phase 1 source list.*
