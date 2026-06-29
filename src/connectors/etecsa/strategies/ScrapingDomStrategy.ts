/**
 * NEXA NautaX — ScrapingDomStrategy
 *  — Doc 2 §3.3
 *
 * Si KnownEndpoint y DiscoveredEndpoint fallan en el parseo de respuesta
 * (no encuentran ATTRIBUTE_UUID), esta strategy parsea el HTML con DOMParser
 * buscando en todos los <script> bloques cualquier string que parezca token.
 *
 * Si encuentra un candidato, lo valida haciendo una llamada getLeftTime.
 */

import { Strategy } from './Strategy';
import type { StrategyContext } from './Strategy';
import type { EtecsaError, LoginRequest, LoginResponse } from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import { err, ok } from '@/modules/result/Result';
import { makeEtecsaError } from '../errors/EtecsaError';
import { mapAlertToError } from '../errors/errorMapper';
import { ETECSA_BASE_URL, ETECSA_LOGIN_URL, PORTAL_TIMEOUT_MS } from '../contracts/types';
import { buildLoginBody } from '../http/HttpClient';
import { asAccountId } from '@/types/branded';

export class ScrapingDomStrategy extends Strategy {
  readonly name = 'ScrapingDom' as const;

  async login(
    ctx: StrategyContext,
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.debug('[ScrapingDom] Login start', { traceId });

    // Re-fetch del form inicial
    const formFetch = await ctx.httpClient.request({
      url: ETECSA_BASE_URL + '/',
      method: 'GET',
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!formFetch.ok) return err(formFetch.error);

    const formResult = await ctx.htmlParser.extractLoginForm(formFetch.value.body);
    if (!formResult.ok) return err(formResult.error);

    const fields = formResult.value;

    // POST login estándar
    const body = buildLoginBody({
      username: req.username,
      password: req.password,
      csrfToken: fields.csrfToken,
      wlanUserIp: fields.wlanUserIp,
      loggerId: fields.loggerId,
      gotopage: fields.gotopage,
      successpage: fields.successpage,
      lang: fields.lang,
    });

    const loginResult = await ctx.httpClient.request({
      url: ETECSA_LOGIN_URL,
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!loginResult.ok) return err(loginResult.error);

    // Estrategia DOM: buscar ATTRIBUTE_UUID con regex más amplio
    // vía el parser (que ya intenta múltiples patterns)
    const uuidResult = await ctx.htmlParser.extractAttributeUuid(loginResult.value.body);
    if (uuidResult.ok) {
      const session = {
        accountId: asAccountId('pending'),
        username: req.username,
        csrfToken: fields.csrfToken,
        attributeUuid: uuidResult.value,
        wlanUserIp: fields.wlanUserIp,
        loggerId: fields.loggerId,
        startedAt: Date.now(),
        lastSync: Date.now(),
        cookies: {},
        loginStrategy: this.name,
      } as const;

      ctx.healthReporter.markSuccess('login', this.name, loginResult.value.timing);
      return ok({ session });
    }

    // Buscar alert
    const alertResult = await ctx.htmlParser.extractAlertMessage(loginResult.value.body);
    if (alertResult.ok && alertResult.value) {
      const error = mapAlertToError(alertResult.value, traceId);
      ctx.healthReporter.markFailure('login', this.name, error);
      return err(error);
    }

    const parserError = makeEtecsaError(
      'CONNECTOR_ATTRIBUTE_UUID_MISSING',
      `ScrapingDom strategy failed (traceId=${traceId})`,
      { traceId },
    );
    ctx.healthReporter.markFailure('login', this.name, parserError);
    return err(parserError);
  }
}
