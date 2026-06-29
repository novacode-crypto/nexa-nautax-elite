/**
 * NEXA NautaX — ETECSA HttpClient
 * Fase 1 — Doc 2 §4 + Fase 4 — Doc 3 §3
 *
 * Wrapper sobre fetch con:
 *  - Timeout configurable
 *  - Retry con backoff exponencial
 *  - Medición de timing (DNS/TCP/TLS/TTFB/total)
 *  - Cookies automáticas (credentials: include)
 *  - Sanitización de URLs en logs
 */

import type {
  HttpRequest,
  HttpResponse,
  HttpTiming,
} from '../contracts/types';
import { DEFAULT_TIMEOUT_MS } from '../contracts/types';
import { err, ok, type Result } from '@/modules/result/Result';
import { sanitize } from '@/modules/logging/sanitize';
import type { EtecsaError } from '../contracts/types';
import { makeEtecsaError } from '../errors/EtecsaError';

export interface HttpClientOptions {
  readonly defaultTimeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryDelaysMs?: readonly number[];
}

const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

export class HttpClient {
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelaysMs: readonly number[];

  constructor(options: HttpClientOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  async request(req: HttpRequest): Promise<Result<HttpResponse, EtecsaError>> {
    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const traceId = crypto.randomUUID();

    let lastError: EtecsaError | null = null;
    const maxAttempts = this.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelaysMs[Math.min(attempt - 1, this.retryDelaysMs.length - 1)]!;
        await sleep(delay);
      }

      const result = await this.singleAttempt(req, timeoutMs, traceId);

      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Solo reintentar si el error es retryable
      if (!result.error.retryable) {
        return result;
      }

      // Si es el último intento, retornar el error
      if (attempt === maxAttempts - 1) {
        return result;
      }

      console.debug('[HttpClient] Retrying', {
        attempt: attempt + 1,
        url: sanitize(req.url),
        error: result.error.code,
      });
    }

    return err(lastError ?? makeEtecsaError('UNKNOWN_ETECSA', 'No attempts made'));
  }

  private async singleAttempt(
    req: HttpRequest,
    timeoutMs: number,
    traceId: string,
  ): Promise<Result<HttpResponse, EtecsaError>> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const fetchOptions: RequestInit = {
        method: req.method,
        signal: controller.signal,
        redirect: req.redirect ?? 'follow',
        credentials: req.credentials ?? 'include',
      };

      if (req.body !== undefined) {
        fetchOptions.body = req.body;
      }

      if (req.headers !== undefined) {
        fetchOptions.headers = req.headers;
      }

      console.debug('[HttpClient] Request', {
        method: req.method,
        url: sanitize(req.url),
        traceId,
      });

      const response = await fetch(req.url, fetchOptions);
      clearTimeout(timeoutId);

      const body = await response.text();
      const total = performance.now() - startTime;

      const timing: HttpTiming = {
        // Sin acceso a PerformanceResourceTiming desde fetch directo,
        // solo medimos total. Los demás campos se llenan con 0 o se
        // pueden obtener de la Performance API si está disponible.
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        total,
      };

      const httpResponse: HttpResponse = {
        status: response.status,
        headers: response.headers,
        body,
        finalUrl: response.url,
        timing,
      };

      console.debug('[HttpClient] Response', {
        status: response.status,
        url: sanitize(req.url),
        durationMs: Math.round(total),
        bodyLength: body.length,
        traceId,
      });

      return ok(httpResponse);
    } catch (error) {
      const total = performance.now() - startTime;
      const etecsaError = this.classifyError(error, total, traceId);
      return err(etecsaError);
    }
  }

  private classifyError(error: unknown, durationMs: number, traceId: string): EtecsaError {
    const msg = error instanceof Error ? error.message : String(error);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return makeEtecsaError(
        'NETWORK_TIMEOUT',
        `Request timed out after ${durationMs}ms (traceId=${traceId})`,
        { cause: error, traceId },
      );
    }

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      // Distinguir offline de unreachable es difícil sin info adicional.
      // Asumimos PORTAL_UNREACHABLE si llegamos aquí; ConnectionMonitor
      // se encarga de marcar OFFLINE globalmente.
      return makeEtecsaError(
        'PORTAL_UNREACHABLE',
        `Network error: ${msg} (traceId=${traceId})`,
        { cause: error, traceId },
      );
    }

    return makeEtecsaError(
      'UNKNOWN_ETECSA',
      `Unexpected error: ${msg} (traceId=${traceId})`,
      { cause: error, traceId },
    );
  }
}

// ═══ Utilidades ════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══ Helpers para construir requests comunes ═══════════════════════

export function buildFormBody(fields: Readonly<Record<string, string>>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }
  return params;
}

export function buildLoginBody(params: {
  readonly username: string;
  readonly password: string;
  readonly csrfToken: string;
  readonly wlanUserIp: string;
  readonly loggerId: string;
  readonly gotopage?: string;
  readonly successpage?: string;
  readonly lang?: string;
}): URLSearchParams {
  return buildFormBody({
    username: params.username,
    password: params.password,
    CSRFHW: params.csrfToken,
    wlanuserip: params.wlanUserIp,
    loggerId: params.loggerId,
    gotopage: params.gotopage ?? '/',
    successpage: params.successpage ?? '',
    lang: params.lang ?? 'es',
    domain: '',
  });
}

export function buildLogoutBody(params: {
  readonly attributeUuid: string;
  readonly csrfToken: string;
  readonly wlanUserIp: string;
  readonly username: string;
  readonly loggerId: string;
}): URLSearchParams {
  // loggerId+username rewrite (ver Fase 1 — Doc 1 §3.4)
  const loggerIdWithUsername = `${params.loggerId}+${params.username}`;
  return buildFormBody({
    ATTRIBUTE_UUID: params.attributeUuid,
    CSRFHW: params.csrfToken,
    wlanuserip: params.wlanUserIp,
    username: params.username,
    loggerId: loggerIdWithUsername,
    remove: '1',
    op: 'logout',
  });
}
