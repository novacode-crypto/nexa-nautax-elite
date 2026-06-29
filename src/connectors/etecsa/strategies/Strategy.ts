/**
 * NEXA NautaX — Strategy base
 *  — Doc 2 §3
 *
 * Cada strategy implementa una forma de hacer login contra ETECSA.
 * El EtecsaConnector las orquesta en orden hasta que una funcione.
 */

import type { HttpClient } from '../http/HttpClient';
import type { HtmlParser } from '../parsing/HtmlParser';
import type { HealthReporter } from '../health/HealthReporter';
import type {
  EtecsaError,
  LoginRequest,
  LoginResponse,
  PortalStatus,
  SessionData,
  SessionInfoResponse,
  StrategyName,
  TimeRemainingResponse,
  BalanceResponse,
  CredentialsVerification,
} from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import type { AccountId } from '@/types/branded';

export interface StrategyContext {
  readonly httpClient: HttpClient;
  readonly htmlParser: HtmlParser;
  readonly healthReporter: HealthReporter;
}

export abstract class Strategy {
  abstract readonly name: StrategyName;

  abstract login(
    ctx: StrategyContext,
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>>;

  /**
   * Las strategies alternativas (Discovered, Scraping) solo implementan login.
   * Las operaciones de consulta (balance, time) usan KnownEndpoint por defecto.
   */
  async logout(
    _ctx: StrategyContext,
    _session: SessionData,
  ): Promise<Result<void, EtecsaError>> {
    // Por defecto, las strategies no implementan logout — solo KnownEndpoint lo hace.
    return Promise.resolve({
      ok: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        category: 'SESSION_ERROR',
        technicalMessage: `${this.name} does not implement logout`,
        userMessage: 'Operación no soportada por esta estrategia.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }

  async getTimeRemaining(
    _ctx: StrategyContext,
    _session: SessionData,
  ): Promise<Result<TimeRemainingResponse, EtecsaError>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'UNKNOWN_ETECSA',
        category: 'UNKNOWN_ERROR',
        technicalMessage: `${this.name} does not implement getTimeRemaining`,
        userMessage: 'Operación no soportada.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }

  async getBalance(
    _ctx: StrategyContext,
    _session: SessionData,
    _accountId: AccountId,
  ): Promise<Result<BalanceResponse, EtecsaError>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'UNKNOWN_ETECSA',
        category: 'UNKNOWN_ERROR',
        technicalMessage: `${this.name} does not implement getBalance`,
        userMessage: 'Operación no soportada.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }

  async getSessionInfo(
    _ctx: StrategyContext,
    _session: SessionData,
    _accountId: AccountId,
  ): Promise<Result<SessionInfoResponse, EtecsaError>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'UNKNOWN_ETECSA',
        category: 'UNKNOWN_ERROR',
        technicalMessage: `${this.name} does not implement getSessionInfo`,
        userMessage: 'Operación no soportada.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }

  async verifyCredentials(
    _ctx: StrategyContext,
    _req: LoginRequest,
  ): Promise<Result<CredentialsVerification, EtecsaError>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'UNKNOWN_ETECSA',
        category: 'UNKNOWN_ERROR',
        technicalMessage: `${this.name} does not implement verifyCredentials`,
        userMessage: 'Operación no soportada.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }

  async probePortal(_ctx: StrategyContext): Promise<Result<PortalStatus, EtecsaError>> {
    return Promise.resolve({
      ok: false,
      error: {
        code: 'UNKNOWN_ETECSA',
        category: 'UNKNOWN_ERROR',
        technicalMessage: `${this.name} does not implement probePortal`,
        userMessage: 'Operación no soportada.',
        recommendedAction: '',
        retryable: false,
        timestamp: Date.now(),
      },
    });
  }
}
