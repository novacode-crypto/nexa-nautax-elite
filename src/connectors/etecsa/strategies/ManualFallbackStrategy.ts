/**
 * NEXA NautaX — ManualFallbackStrategy
 *  — Doc 2 §3.5
 *
 * Si todas las strategies automáticas fallan, esta strategy retorna
 * un error tipado que la UI interpreta como "operación manual requerida".
 * NO intenta nada — es solo un terminal graceful.
 */

import { Strategy } from './Strategy';
import type { StrategyContext } from './Strategy';
import type { EtecsaError, LoginRequest, LoginResponse } from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import { err } from '@/modules/result/Result';
import { makeEtecsaError } from '../errors/EtecsaError';

export class ManualFallbackStrategy extends Strategy {
  readonly name = 'ManualFallback' as const;

  async login(
    ctx: StrategyContext,
    _req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    const traceId = crypto.randomUUID();
    console.warn('[ManualFallback] All strategies failed', { traceId });

    const error = makeEtecsaError(
      'CONNECTOR_PARSER_FAILED',
      `All automated strategies exhausted (traceId=${traceId}). Manual intervention required.`,
      { traceId },
    );

    ctx.healthReporter.markFailure('login', this.name, error);
    return err(error);
  }
}
