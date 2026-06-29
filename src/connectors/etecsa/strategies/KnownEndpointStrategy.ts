/**
 * NEXA NautaX — KnownEndpointStrategy (PRIMARY)
 * Fase 1 — Doc 2 §3.1
 *
 * Usa URLs hardcoded y selectores primarios conocidos de ETECSA.
 * Exitosa en >95% de los casos según consenso de los 11 repos investigados.
 *
 * Flujo:
 *   1. GET / → obtener form inicial con CSRFHW + wlanuserip
 *   2. POST //LoginServlet → autenticar
 *   3. Parsear respuesta:
 *      - Éxito: extraer ATTRIBUTE_UUID
 *      - Fallo: extraer alert("...") y mapear a error
 */

import { Strategy } from './Strategy';
import type { StrategyContext } from './Strategy';
import type { EtecsaError, LoginRequest, LoginResponse, PortalStatus, SessionData, TimeRemainingResponse } from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import { err, ok } from '@/modules/result/Result';
import { asAccountId, asCsrfToken, asWlanUserIp } from '@/types/branded';
import {
  ETECSA_BASE_URL,
  ETECSA_LOGIN_URL,
  ETECSA_LOGOUT_URL,
  ETECSA_QUERY_URL,
  PROBE_ETECSA_PORTAL,
  PROBE_GOOGLE_204,
  PROBE_TIMEOUT_MS,
  PORTAL_TIMEOUT_MS,
} from '../contracts/types';
import { buildLoginBody, buildLogoutBody } from '../http/HttpClient';
import { makeEtecsaError } from '../errors/EtecsaError';
import { mapAlertToError } from '../errors/errorMapper';

export class KnownEndpointStrategy extends Strategy {
  readonly name = 'KnownEndpoint' as const;

  async login(
    ctx: StrategyContext,
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.debug('[KnownEndpoint] Login start', { traceId, username: req.username });

    // Step 1: GET / para obtener form inicial
    const formResult = await this.fetchLoginForm(ctx, traceId);
    if (!formResult.ok) return formResult;

    const formFields = formResult.value;

    // Step 2: POST //LoginServlet
    const loginResult = await this.postLogin(ctx, req, formFields);
    if (!loginResult.ok) return loginResult;

    // Step 3: Parsear respuesta para extraer ATTRIBUTE_UUID o error
    const parseResult = await ctx.htmlParser.extractAttributeUuid(loginResult.value.body);
    if (parseResult.ok) {
      // Login exitoso
      const session: SessionData = {
        accountId: asAccountId('pending'), // AccountManager lo setea después
        username: req.username,
        csrfToken: formFields.csrfToken,
        attributeUuid: parseResult.value,
        wlanUserIp: formFields.wlanUserIp,
        loggerId: formFields.loggerId,
        startedAt: Date.now(),
        lastSync: Date.now(),
        cookies: {}, // Las cookies las maneja el browser automáticamente
        loginStrategy: this.name,
      };

      ctx.healthReporter.markSuccess('login', this.name, loginResult.value.timing);
      console.info('[KnownEndpoint] Login success', { traceId });
      return ok({ session });
    }

    // No se encontró ATTRIBUTE_UUID — buscar alert de error
    const alertResult = await ctx.htmlParser.extractAlertMessage(loginResult.value.body);
    if (alertResult.ok && alertResult.value) {
      const error = mapAlertToError(alertResult.value, traceId);
      ctx.healthReporter.markFailure('login', this.name, error);
      console.warn('[KnownEndpoint] Login failed (alert)', {
        traceId,
        alert: alertResult.value,
        code: error.code,
      });
      return err(error);
    }

    // Sin ATTRIBUTE_UUID ni alert — error de parser
    const parserError = makeEtecsaError(
      'CONNECTOR_ATTRIBUTE_UUID_MISSING',
      `Cannot find ATTRIBUTE_UUID or alert in login response (traceId=${traceId})`,
      { traceId },
    );
    ctx.healthReporter.markFailure('login', this.name, parserError);
    return err(parserError);
  }

  async logout(
    ctx: StrategyContext,
    session: SessionData,
  ): Promise<Result<void, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.debug('[KnownEndpoint] Logout start', { traceId });

    const body = buildLogoutBody({
      attributeUuid: session.attributeUuid,
      csrfToken: session.csrfToken,
      wlanUserIp: session.wlanUserIp,
      username: session.username,
      loggerId: session.loggerId,
    });

    const result = await ctx.httpClient.request({
      url: ETECSA_LOGOUT_URL,
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!result.ok) {
      // Si la sesión no existe en ETECSA, tratar como éxito
      if (result.error.code === 'SESSION_NOT_FOUND') {
        ctx.healthReporter.markSuccess('logout', this.name, { dns: 0, tcp: 0, tls: 0, ttfb: 0, total: 0 });
        return ok(undefined);
      }
      ctx.healthReporter.markFailure('logout', this.name, result.error);
      return err(result.error);
    }

    ctx.healthReporter.markSuccess('logout', this.name, result.value.timing);
    console.info('[KnownEndpoint] Logout success', { traceId });
    return ok(undefined);
  }

  async getTimeRemaining(
    ctx: StrategyContext,
    session: SessionData,
  ): Promise<Result<TimeRemainingResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    const body = new URLSearchParams({
      op: 'getLeftTime',
      CSRFHW: session.csrfToken,
      ATTRIBUTE_UUID: session.attributeUuid,
      wlanuserip: session.wlanUserIp,
      username: session.username,
      loggerId: `${session.loggerId}+${session.username}`,
    });

    const result = await ctx.httpClient.request({
      url: ETECSA_QUERY_URL,
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!result.ok) {
      ctx.healthReporter.markFailure('time', this.name, result.error);
      return err(result.error);
    }

    // Respuesta esperada: "HH:MM:SS" en texto plano
    const text = result.value.body.trim();
    const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(text);
    if (!match) {
      const error = makeEtecsaError(
        'BALANCE_UNAVAILABLE',
        `Cannot parse time remaining: ${text.slice(0, 50)} (traceId=${traceId})`,
        { traceId },
      );
      ctx.healthReporter.markFailure('time', this.name, error);
      return err(error);
    }

    const hours = parseInt(match[1]!, 10);
    const minutes = parseInt(match[2]!, 10);
    const seconds = parseInt(match[3]!, 10);
    const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;

    ctx.healthReporter.markSuccess('time', this.name, result.value.timing);
    return ok({
      remaining: { ms },
      startedAt: session.startedAt,
      fetchedAt: Date.now(),
    });
  }

  async probePortal(ctx: StrategyContext): Promise<Result<PortalStatus, EtecsaError>> {
    // Probe A: Google 204 — si responde 204, hay internet (ONLINE)
    // Esto funciona tanto si la sesión la iniciamos nosotros como si fue externa
    const probeA = await ctx.httpClient.request({
      url: PROBE_GOOGLE_204,
      method: 'GET',
      timeoutMs: PROBE_TIMEOUT_MS,
      redirect: 'manual',
    });

    if (probeA.ok && probeA.value.status === 204) {
      return ok({ kind: 'ONLINE', captivePortal: false });
    }

    // Si el probe A falla pero retorna cualquier status (no 204),
    // puede ser que el portal cautivo está redirigiendo la petición
    if (probeA.ok && (probeA.value.status === 200 || probeA.value.status === 302 || probeA.value.status === 301)) {
      // Si Google responde con 200 o redirect, probablemente estamos en portal cautivo
      // (Google 204 solo responde 204 cuando hay internet real sin redirección)
    }

    // Probe B: ETECSA portal — si tiene formulario, es portal cautivo
    const probeB = await ctx.httpClient.request({
      url: PROBE_ETECSA_PORTAL,
      method: 'GET',
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (probeB.ok) {
      const body = probeB.value.body.toLowerCase();
      const hasForm = body.includes('formulario') || body.includes('csrfhw') || body.includes('wlanuserip');
      if (hasForm) {
        return ok({ kind: 'CAPTIVE_PORTAL', captivePortal: true });
      }
      // Si ETECSA responde pero sin formulario, probablemente ya hay sesión
      return ok({ kind: 'ONLINE', captivePortal: false });
    }

    // Si ambos fallan, asumimos offline
    return ok({
      kind: 'OFFLINE',
      captivePortal: false,
      reason: 'All probes failed',
    });
  }

  // —— Privados ————————————————————————————————————————————————

  private async fetchLoginForm(
    ctx: StrategyContext,
    traceId: string,
  ): Promise<Result<LoginFormFieldsResolved, EtecsaError>> {
    const result = await ctx.httpClient.request({
      url: ETECSA_BASE_URL + '/',
      method: 'GET',
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!result.ok) {
      const error = result.error;
      ctx.healthReporter.markFailure('login', this.name, error);
      return err(error);
    }

    const parseResult = await ctx.htmlParser.extractLoginForm(result.value.body);
    if (!parseResult.ok) {
      const error = makeEtecsaError(
        'CONNECTOR_CSRF_MISSING',
        `Cannot extract login form (traceId=${traceId})`,
        { traceId, cause: parseResult.error },
      );
      ctx.healthReporter.markFailure('login', this.name, error);
      return err(error);
    }

    return ok(parseResult.value);
  }

  private async postLogin(
    ctx: StrategyContext,
    req: LoginRequest,
    formFields: LoginFormFieldsResolved,
  ): Promise<Result<{ body: string; timing: { dns: number; tcp: number; tls: number; ttfb: number; total: number } }, EtecsaError>> {
    const body = buildLoginBody({
      username: req.username,
      password: req.password,
      csrfToken: formFields.csrfToken,
      wlanUserIp: formFields.wlanUserIp,
      loggerId: formFields.loggerId,
      gotopage: formFields.gotopage,
      successpage: formFields.successpage,
      lang: formFields.lang,
    });

    const result = await ctx.httpClient.request({
      url: ETECSA_LOGIN_URL,
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!result.ok) {
      return err(result.error);
    }

    return ok({ body: result.value.body, timing: result.value.timing });
  }
}

// Tipo interno para los campos del form ya resueltos
type LoginFormFieldsResolved = {
  readonly csrfToken: ReturnType<typeof asCsrfToken>;
  readonly wlanUserIp: ReturnType<typeof asWlanUserIp>;
  readonly loggerId: string;
  readonly gotopage: string;
  readonly successpage: string;
  readonly lang: string;
  readonly action: string;
};
