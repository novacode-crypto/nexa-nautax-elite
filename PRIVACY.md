# NEXA NautaX — Privacy Policy

## Data Collection

NEXA NautaX does NOT collect, transmit, or sell any personal data.

## Local Storage

All user data is stored locally in the browser via `chrome.storage.local`:

- **Accounts**: Nauta usernames and AES-256 encrypted passwords
- **Sessions**: Active session tokens (CSRFHW, ATTRIBUTE_UUID)
- **Settings**: User preferences (theme, notifications, etc.)
- **History**: Session history (durations, no credentials)
- **Logs**: Sanitized diagnostic logs (no sensitive data)

## Encryption

Credentials are encrypted with AES-256-GCM. The encryption key is derived
from a master password using PBKDF2 (250,000 iterations, SHA-256).

The key is stored in `chrome.storage.session` and is lost when the browser
is closed, requiring the user to re-enter the master password.

## Network Communication

The extension only communicates with:

- `https://secure.etecsa.net:8443/*` — ETECSA captive portal (login, logout, balance)

No other network requests are made. No telemetry, no analytics.

## Third-Party Services

None.

## Open Source

NEXA NautaX is open source. You can audit the code at any time.

## Contact

For privacy concerns, please open an issue on the project repository.
