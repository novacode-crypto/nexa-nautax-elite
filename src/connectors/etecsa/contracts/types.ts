/**
 * NEXA NautaX — ETECSA Connector Types
 * Fase 1 — Doc 2 §2 + Fase 4 — Doc 1 §3
 *
 * Contratos del ETECSA Connector Layer.
 * Único punto de contacto entre NEXA NautaX y ETECSA.
 */

import type {
  AccountId,
  AttributeUuid,
  CsrfToken,
  WlanUserIp,
} from '@/types/branded';

// ═══ Strategy Names ═════════════════════════════════════════════════

export type StrategyName =
  | 'KnownEndpoint'
  | 'DiscoveredEndpoint'
  | 'ScrapingDom'
  | 'ScrapingRegex'
  | 'ManualFallback';

// ═══ Login ═════════════════════════════════════════════════════════

export interface LoginRequest {
  readonly username: string;
  readonly password: string;
  readonly accountType: 'prepaid';
}

export interface LoginResponse {
  readonly session: SessionData;
  readonly timeRemaining?: Duration;
}

// ═══ SessionData ═══════════════════════════════════════════════════

export interface SessionData {
  readonly accountId: AccountId;
  readonly username: string;
  readonly csrfToken: CsrfToken;
  readonly attributeUuid: AttributeUuid;
  readonly wlanUserIp: WlanUserIp;
  readonly loggerId: string;
  readonly startedAt: number;
  readonly lastSync: number;
  readonly cookies: Readonly<Record<string, string>>;
  readonly loginStrategy: StrategyName;
}

// ═══ Balance / Time / Session Info ═════════════════════════════════

export interface BalanceResponse {
  readonly accountId: AccountId;
  readonly amount: number;
  readonly currency: 'CUP';
  readonly lastUpdated: number;
  readonly expiresAt: number | null;
  readonly estimatedTimeRemaining?: Duration;
}

export interface TimeRemainingResponse {
  readonly remaining: Duration;
  readonly startedAt: number;
  readonly fetchedAt: number;
}

export interface SessionInfoResponse {
  readonly session: SessionData;
  readonly timeRemaining?: Duration;
  readonly balance?: BalanceResponse;
}

export interface CredentialsVerification {
  readonly valid: boolean;
  readonly balance?: BalanceResponse;
  readonly error?: EtecsaError;
}

// ═══ Duration ══════════════════════════════════════════════════════

export interface Duration {
  readonly ms: number;
}

// ═══ Portal Status ═════════════════════════════════════════════════

export type PortalStatus =
  | { readonly kind: 'ONLINE'; readonly captivePortal: false }
  | { readonly kind: 'CAPTIVE_PORTAL'; readonly captivePortal: true }
  | { readonly kind: 'OFFLINE'; readonly captivePortal: false; readonly reason: string };

// ═══ EtecsaError ═══════════════════════════════════════════════════

export type EtecsaErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_ACCOUNT_BLOCKED'
  | 'AUTH_UNKNOWN_FAILURE'
  | 'SESSION_EXPIRED'
  | 'SESSION_IN_USE'
  | 'SESSION_NOT_FOUND'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_DNS'
  | 'NETWORK_OFFLINE'
  | 'PORTAL_UNREACHABLE'
  | 'CONNECTOR_PARSER_FAILED'
  | 'CONNECTOR_CSRF_MISSING'
  | 'CONNECTOR_ATTRIBUTE_UUID_MISSING'
  | 'CONNECTOR_DEGRADED'
  | 'BALANCE_ZERO'
  | 'BALANCE_UNAVAILABLE'
  | 'UNKNOWN_ETECSA';

export type EtecsaErrorCategory =
  | 'AUTH_ERROR'
  | 'SESSION_ERROR'
  | 'NETWORK_ERROR'
  | 'CONNECTOR_ERROR'
  | 'BALANCE_ERROR'
  | 'UNKNOWN_ERROR';

export interface EtecsaError {
  readonly code: EtecsaErrorCode;
  readonly category: EtecsaErrorCategory;
  readonly technicalMessage: string;
  readonly userMessage: string;
  readonly recommendedAction: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly traceId?: string;
}

// ═══ ConnectorHealth ═══════════════════════════════════════════════

export interface ConnectorHealth {
  readonly lastOperation: 'login' | 'logout' | 'balance' | 'time' | 'verify' | 'probe' | null;
  readonly lastSuccessAt: number | null;
  readonly lastError: EtecsaError | null;
  readonly currentStrategy: StrategyName;
  readonly consecutiveFailures: number;
  readonly totalOperations: number;
  readonly totalSuccesses: number;
  readonly totalFailures: number;
}

// ═══ HttpClient Types ══════════════════════════════════════════════

export interface HttpRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly body?: URLSearchParams | string;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly redirect?: 'manual' | 'follow';
  readonly credentials?: 'include' | 'omit';
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
  readonly finalUrl: string;
  readonly timing: HttpTiming;
}

export interface HttpTiming {
  readonly dns: number;
  readonly tcp: number;
  readonly tls: number;
  readonly ttfb: number;
  readonly total: number;
}

// ═══ HtmlParser Types ══════════════════════════════════════════════

export interface LoginFormFields {
  readonly csrfToken: CsrfToken;
  readonly wlanUserIp: WlanUserIp;
  readonly loggerId: string;
  readonly gotopage: string;
  readonly successpage: string;
  readonly lang: string;
  readonly action: string;
}

export interface SessionInfoFields {
  readonly balance?: number | undefined;
  readonly currency: 'CUP';
  readonly expiresAt?: number | undefined;
  readonly timeRemaining?: Duration | undefined;
}

export type OffscreenRequest =
  | { readonly type: 'PARSE_LOGIN_FORM'; readonly html: string }
  | { readonly type: 'EXTRACT_ATTRIBUTE_UUID'; readonly html: string }
  | { readonly type: 'EXTRACT_ALERT_MESSAGE'; readonly html: string }
  | { readonly type: 'EXTRACT_SESSION_INFO'; readonly html: string };

export type OffscreenResponse =
  | { readonly ok: true; readonly data: ParsedData }
  | { readonly ok: false; readonly error: string };

export type ParsedData =
  | { readonly kind: 'loginForm'; readonly fields: LoginFormFields }
  | { readonly kind: 'attributeUuid'; readonly uuid: AttributeUuid }
  | { readonly kind: 'alertMessage'; readonly message: string | null }
  | { readonly kind: 'sessionInfo'; readonly fields: SessionInfoFields };

// ═══ Constants — ETECSA Portal URLs ════════════════════════════════

export const ETECSA_BASE_URL = 'https://secure.etecsa.net:8443';
export const ETECSA_LOGIN_PATH = '/LoginServlet';
export const ETECSA_LOGOUT_PATH = '/LogoutServlet';
export const ETECSA_QUERY_PATH = '/EtecsaQueryServlet';

// Doble slash intencional — ETECSA lo requiere (ver Fase 1 — Doc 1 §3.2)
export const ETECSA_LOGIN_URL = `${ETECSA_BASE_URL}//LoginServlet`;
export const ETECSA_LOGOUT_URL = `${ETECSA_BASE_URL}${ETECSA_LOGOUT_PATH}`;
export const ETECSA_QUERY_URL = `${ETECSA_BASE_URL}${ETECSA_QUERY_PATH}`;

// Probe endpoints
export const PROBE_GOOGLE_204 = 'http://connectivitycheck.gstatic.com/generate_204';
export const PROBE_ETECSA_PORTAL = ETECSA_BASE_URL + '/';
export const PROBE_CLOUDFLARE = 'http://1.1.1.1/cdn-cgi/trace';

// Timeouts
export const DEFAULT_TIMEOUT_MS = 15_000;
export const PROBE_TIMEOUT_MS = 5_000;
export const PORTAL_TIMEOUT_MS = 8_000;
