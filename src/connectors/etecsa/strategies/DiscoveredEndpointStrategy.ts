/**
 * NEXA NautaX — DiscoveredEndpointStrategy
 *  — Doc 2 §3.2
 *
 * Si KnownEndpoint falla por parser (HTML cambió), esta strategy:
 *   1. Re-fetch del form inicial.
 *   2. Usa el action del form descubierto (cualquiera que sea).
 *   3. Cosecha TODOS los inputs hidden.
 *
 * Inspirado en qvacall-cli/getLoginParameters().
 */

import { Strategy } from './Strategy';
import type { StrategyContext } from './Strategy';
import type { EtecsaError, LoginRequest, LoginResponse } from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import { err, ok } from '@/modules/result/Result';
import { makeEtecsaError } from '../errors/EtecsaError';
import { mapAlertToError } from '../errors/errorMapper';
import { ETECSA_BASE_URL, PORTAL_TIMEOUT_MS } from '../contracts/types';
import { buildFormBody } from '../http/HttpClient';
import { asAccountId } from '@/types/branded';

export class DiscoveredEndpointStrategy extends Strategy {
  readonly name = 'DiscoveredEndpoint' as const;

  async login(
    ctx: StrategyContext,
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.debug('[DiscoveredEndpoint] Login start', { traceId });

    // Re-fetch del portal
    const fetchResult = await ctx.httpClient.request({
      url: ETECSA_BASE_URL + '/',
      method: 'GET',
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!fetchResult.ok) {
      return err(fetchResult.error);
    }

    // Extraer form (mismo parser, pero usamos el action descubierto)
    const formResult = await ctx.htmlParser.extractLoginForm(fetchResult.value.body);
    if (!formResult.ok) {
      return err(formResult.error);
    }

    const fields = formResult.value;

    // Construir body con todos los campos
    const body = buildFormBody({
      username: req.username,
      password: req.password,
      CSRFHW: fields.csrfToken,
      wlanuserip: fields.wlanUserIp,
      loggerId: fields.loggerId,
      gotopage: fields.gotopage || '/',
      successpage: fields.successpage || '',
      lang: fields.lang || 'es',
      domain: '',
    });

    // Usar la action descubierta si no es la canónica
    const loginUrl = fields.action.startsWith('http')
      ? fields.action
      : fields.action.startsWith('//')
        ? 'https:' + fields.action
        : ETECSA_BASE_URL + (fields.action.startsWith('/') ? '' : '/') + fields.action;

    console.debug('[DiscoveredEndpoint] Discovered login URL', {
      traceId,
      action: fields.action,
      url: loginUrl,
    });

    const loginResult = await ctx.httpClient.request({
      url: loginUrl,
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!loginResult.ok) {
      return err(loginResult.error);
    }

    // Intentar extraer ATTRIBUTE_UUID
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

    // Sin UUID — buscar alert
    const alertResult = await ctx.htmlParser.extractAlertMessage(loginResult.value.body);
    if (alertResult.ok && alertResult.value) {
      const error = mapAlertToError(alertResult.value, traceId);
      ctx.healthReporter.markFailure('login', this.name, error);
      return err(error);
    }

    const parserError = makeEtecsaError(
      'CONNECTOR_ATTRIBUTE_UUID_MISSING',
      `Discovered strategy also failed (traceId=${traceId})`,
      { traceId },
    );
    ctx.healthReporter.markFailure('login', this.name, parserError);
    return err(parserError);
  }
}
