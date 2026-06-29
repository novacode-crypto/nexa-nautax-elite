/**
 * NEXA NautaX — ScrapingRegexStrategy
 * Fase 1 — Doc 2 §3.4
 *
 * Última línea de defensa automatizada. Si DOMParser no encuentra nada,
 * caemos a regex crudo sobre el HTML con múltiples patterns alternativos.
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
import { asAccountId, asAttributeUuid } from '@/types/branded';

// Patterns alternativos para ATTRIBUTE_UUID
const ATTRIBUTE_UUID_PATTERNS: readonly RegExp[] = [
  /ATTRIBUTE_UUID=(\w+)&CSRFHW=/,
  /attribute_uuid=([a-f0-9]+)/i,
  /window\.__SESSION__\s*=\s*['"](\w+)['"]/,
  /sessionToken\s*[:=]\s*['"](\w{16,})['"]/i,
  /\b([a-f0-9]{32,64})\b/, // hex string largo
];

export class ScrapingRegexStrategy extends Strategy {
  readonly name = 'ScrapingRegex' as const;

  async login(
    ctx: StrategyContext,
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.debug('[ScrapingRegex] Login start', { traceId });

    // Mismo flujo que las anteriores
    const formFetch = await ctx.httpClient.request({
      url: ETECSA_BASE_URL + '/',
      method: 'GET',
      timeoutMs: PORTAL_TIMEOUT_MS,
    });

    if (!formFetch.ok) return err(formFetch.error);

    const formResult = await ctx.htmlParser.extractLoginForm(formFetch.value.body);
    if (!formResult.ok) return err(formResult.error);

    const fields = formResult.value;

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

    // Aplicar todos los patterns regex
    const html = loginResult.value.body;
    for (const pattern of ATTRIBUTE_UUID_PATTERNS) {
      const match = pattern.exec(html);
      if (match && match[1]) {
        const candidate = match[1];
        console.debug('[ScrapingRegex] Candidate found', { traceId, pattern: pattern.source });

        const session = {
          accountId: asAccountId('pending'),
          username: req.username,
          csrfToken: fields.csrfToken,
          attributeUuid: asAttributeUuid(candidate),
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
    }

    // Sin candidato — buscar alert
    const alertResult = await ctx.htmlParser.extractAlertMessage(html);
    if (alertResult.ok && alertResult.value) {
      const error = mapAlertToError(alertResult.value, traceId);
      ctx.healthReporter.markFailure('login', this.name, error);
      return err(error);
    }

    const parserError = makeEtecsaError(
      'CONNECTOR_ATTRIBUTE_UUID_MISSING',
      `ScrapingRegex strategy failed (traceId=${traceId})`,
      { traceId },
    );
    ctx.healthReporter.markFailure('login', this.name, parserError);
    return err(parserError);
  }
}
