/**
 * NEXA NautaX — ETECSA Connector Barrel
 */

export type { IEtecsaConnector } from './contracts/IEtecsaConnector';
export type {
  BalanceResponse,
  ConnectorHealth,
  CredentialsVerification,
  Duration,
  EtecsaError,
  EtecsaErrorCategory,
  EtecsaErrorCode,
  HttpRequest,
  HttpResponse,
  HttpTiming,
  LoginFormFields,
  LoginRequest,
  LoginResponse,
  OffscreenRequest,
  OffscreenResponse,
  ParsedData,
  PortalStatus,
  SessionData,
  SessionInfoFields,
  SessionInfoResponse,
  StrategyName,
  TimeRemainingResponse,
} from './contracts/types';
export {
  ETECSA_BASE_URL,
  ETECSA_LOGIN_PATH,
  ETECSA_LOGIN_URL,
  ETECSA_LOGOUT_PATH,
  ETECSA_LOGOUT_URL,
  ETECSA_QUERY_PATH,
  ETECSA_QUERY_URL,
  PROBE_CLOUDFLARE,
  PROBE_ETECSA_PORTAL,
  PROBE_GOOGLE_204,
  DEFAULT_TIMEOUT_MS,
  PROBE_TIMEOUT_MS,
  PORTAL_TIMEOUT_MS,
} from './contracts/types';

export { EtecsaConnector, getEtecsaConnector, resetEtecsaConnector } from './EtecsaConnector';
export type { EtecsaConnectorOptions } from './EtecsaConnector';

export { MockEtecsaConnector } from './MockEtecsaConnector';
export type { MockOptions } from './MockEtecsaConnector';

export { ETECSA_ERROR_CATALOG, makeEtecsaError, toEtecsaError } from './errors/EtecsaError';
export {
  findErrorByMessage,
  levenshtein,
  mapMessageToCode,
  normalize,
} from './errors/errorCatalog';
export {
  makeError,
  makeParserError,
  mapAlertToError,
  mapNetworkError,
} from './errors/errorMapper';

export { HttpClient, buildFormBody, buildLoginBody, buildLogoutBody } from './http/HttpClient';
export type { HttpClientOptions } from './http/HttpClient';

export { HtmlParser } from './parsing/HtmlParser';
export {
  asValidAttributeUuid,
  asValidCsrfToken,
  asValidWlanUserIp,
  isParsedData,
  isValidAttributeUuid,
  isValidCsrfToken,
  isValidWlanUserIp,
} from './parsing/HtmlParser';
export { OffscreenBridge, getOffscreenBridge } from './parsing/OffscreenBridge';

export {
  DefaultHealthReporter,
  getHealthReporter,
  setHealthReporter,
} from './health/HealthReporter';
export type { HealthReporter } from './health/HealthReporter';

export { Strategy } from './strategies/Strategy';
export type { StrategyContext } from './strategies/Strategy';
export { KnownEndpointStrategy } from './strategies/KnownEndpointStrategy';
export { DiscoveredEndpointStrategy } from './strategies/DiscoveredEndpointStrategy';
export { ScrapingDomStrategy } from './strategies/ScrapingDomStrategy';
export { ScrapingRegexStrategy } from './strategies/ScrapingRegexStrategy';
export { ManualFallbackStrategy } from './strategies/ManualFallbackStrategy';
