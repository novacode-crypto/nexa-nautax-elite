/**
 * NEXA NautaX — EtecsaConnector Facade
 * Fase 1 — Doc 2 §1-3
 *
 * Único punto público del connector. Orquesta:
 *  - HttpClient
 *  - HtmlParser (via OffscreenBridge)
 *  - Strategy chain (5 strategies en orden)
 *  - HealthReporter
 *
 * La UI y servicios solo ven esta interfaz.
 */

import type { AccountId } from '@/types/branded';
import type {
  BalanceResponse,
  ConnectorHealth,
  CredentialsVerification,
  EtecsaError,
  LoginRequest,
  LoginResponse,
  PortalStatus,
  SessionData,
  SessionInfoResponse,
  TimeRemainingResponse,
} from './contracts/types';
import type { Result } from '@/modules/result/Result';
import type { IEtecsaConnector } from './contracts/IEtecsaConnector';
import { HttpClient } from './http/HttpClient';
import { HtmlParser } from './parsing/HtmlParser';
import {
  DefaultHealthReporter,
  type HealthReporter,
  setHealthReporter,
} from './health/HealthReporter';
import { Strategy } from './strategies/Strategy';
import { KnownEndpointStrategy } from './strategies/KnownEndpointStrategy';
import { DiscoveredEndpointStrategy } from './strategies/DiscoveredEndpointStrategy';
import { ScrapingDomStrategy } from './strategies/ScrapingDomStrategy';
import { ScrapingRegexStrategy } from './strategies/ScrapingRegexStrategy';
import { ManualFallbackStrategy } from './strategies/ManualFallbackStrategy';

export interface EtecsaConnectorOptions {
  readonly httpClient?: HttpClient;
  readonly htmlParser?: HtmlParser;
  readonly healthReporter?: HealthReporter;
  readonly strategies?: readonly Strategy[];
}

export class EtecsaConnector implements IEtecsaConnector {
  private readonly httpClient: HttpClient;
  private readonly htmlParser: HtmlParser;
  private readonly healthReporter: HealthReporter;
  private readonly strategies: readonly Strategy[];

  constructor(options: EtecsaConnectorOptions = {}) {
    this.httpClient = options.httpClient ?? new HttpClient();
    this.htmlParser = options.htmlParser ?? new HtmlParser();

    const reporter = options.healthReporter ?? new DefaultHealthReporter();
    this.healthReporter = reporter;
    setHealthReporter(reporter);

    this.strategies = options.strategies ?? [
      new KnownEndpointStrategy(),
      new DiscoveredEndpointStrategy(),
      new ScrapingDomStrategy(),
      new ScrapingRegexStrategy(),
      new ManualFallbackStrategy(),
    ];
  }

  async login(
    req: LoginRequest,
  ): Promise<Result<LoginResponse, EtecsaError>> {
    return this.executeWithChain('login', (strategy, ctx) => strategy.login(ctx, req));
  }

  async logout(
    session: SessionData,
  ): Promise<Result<void, EtecsaError>> {
    // Logout solo lo implementa KnownEndpoint
    const known = this.findStrategy('KnownEndpoint');
    if (!known) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ETECSA',
          category: 'UNKNOWN_ERROR',
          technicalMessage: 'KnownEndpointStrategy not found',
          userMessage: 'Error interno.',
          recommendedAction: '',
          retryable: false,
          timestamp: Date.now(),
        },
      };
    }

    const ctx = this.makeContext();
    const result = await known.logout(ctx, session);

    // Si la sesión ya no existe, tratar como éxito
    if (!result.ok && result.error.code === 'SESSION_NOT_FOUND') {
      return { ok: true, value: undefined };
    }

    return result;
  }

  async getTimeRemaining(
    session: SessionData,
  ): Promise<Result<TimeRemainingResponse, EtecsaError>> {
    const known = this.findStrategy('KnownEndpoint');
    if (!known) return ({ ok: false, error: this.makeUnknownError('KnownEndpointStrategy not found') });
    return known.getTimeRemaining(this.makeContext(), session);
  }

  async getBalance(
    session: SessionData,
    accountId: AccountId,
  ): Promise<Result<BalanceResponse, EtecsaError>> {
    // En Fase 6, getBalance se obtiene via getSessionInfo.
    const infoResult = await this.getSessionInfo(session, accountId);
    if (!infoResult.ok) return infoResult;
    if (!infoResult.value.balance) {
      return {
        ok: false,
        error: {
          code: 'BALANCE_UNAVAILABLE',
          category: 'BALANCE_ERROR',
          technicalMessage: 'Balance not available in session info',
          userMessage: 'No se pudo obtener el saldo.',
          recommendedAction: '',
          retryable: true,
          timestamp: Date.now(),
        },
      };
    }
    return { ok: true, value: infoResult.value.balance };
  }

  async getSessionInfo(
    session: SessionData,
    accountId: AccountId,
  ): Promise<Result<SessionInfoResponse, EtecsaError>> {
    const known = this.findStrategy('KnownEndpoint');
    if (!known) return ({ ok: false, error: this.makeUnknownError('KnownEndpointStrategy not found') });
    return known.getSessionInfo(this.makeContext(), session, accountId);
  }

  async verifyCredentials(
    req: LoginRequest,
  ): Promise<Result<CredentialsVerification, EtecsaError>> {
    // En Fase 6, verifyCredentials = login + getBalance + logout inmediato.
    // Si el login falla por credenciales, retornamos { valid: false }.
    const loginResult = await this.login(req);
    if (!loginResult.ok) {
      if (
        loginResult.error.code === 'AUTH_INVALID_CREDENTIALS' ||
        loginResult.error.code === 'AUTH_RATE_LIMITED' ||
        loginResult.error.code === 'AUTH_ACCOUNT_BLOCKED'
      ) {
        return {
          ok: true,
          value: { valid: false, error: loginResult.error },
        };
      }
      return loginResult;
    }

    // Login OK — obtener balance y logout
    const session = loginResult.value.session;
    const balanceResult = await this.getBalance(session, session.accountId);
    await this.logout(session);

    return {
      ok: true,
      value: {
        valid: true,
        ...(balanceResult.ok ? { balance: balanceResult.value } : {}),
      },
    };
  }

  async probePortal(): Promise<Result<PortalStatus, EtecsaError>> {
    const known = this.findStrategy('KnownEndpoint');
    if (!known) return ({ ok: false, error: this.makeUnknownError('KnownEndpointStrategy not found') });
    return known.probePortal(this.makeContext());
  }

  getHealth(): ConnectorHealth {
    return this.healthReporter.snapshot();
  }

  // —— Privados ————————————————————————————————————————————————

  private findStrategy(name: Strategy['name']): Strategy | undefined {
    return this.strategies.find((s) => s.name === name);
  }

  private makeContext() {
    return {
      httpClient: this.httpClient,
      htmlParser: this.htmlParser,
      healthReporter: this.healthReporter,
    };
  }

  /**
   * Ejecuta la cadena de strategies hasta que una tenga éxito.
   * Solo avanza a la siguiente si el error es de tipo CONNECTOR (parser).
   * Errores AUTH, NETWORK, etc. no justifican probar otra strategy.
   */
  private async executeWithChain<T>(
    operation: string,
    run: (strategy: Strategy, ctx: ReturnType<EtecsaConnector['makeContext']>) => Promise<Result<T, EtecsaError>>,
  ): Promise<Result<T, EtecsaError>> {
    const ctx = this.makeContext();
    let lastError: EtecsaError | null = null;

    for (let i = 0; i < this.strategies.length; i++) {
      const strategy = this.strategies[i]!;
      const prevStrategy = i > 0 ? this.strategies[i - 1] : null;

      if (prevStrategy) {
        this.healthReporter.markFallback(operation, prevStrategy.name, strategy.name);
        console.debug(`[EtecsaConnector] Falling back to ${strategy.name}`, { operation });
      }

      const result = await run(strategy, ctx);

      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Si el error no es de CONNECTOR, no tiene sentido probar otra strategy
      if (result.error.category !== 'CONNECTOR_ERROR') {
        return result;
      }
    }

    return { ok: false, error: lastError ?? this.makeUnknownError('No strategies ran') };
  }

  private makeUnknownError(message: string): EtecsaError {
    return {
      code: 'UNKNOWN_ETECSA',
      category: 'UNKNOWN_ERROR',
      technicalMessage: message,
      userMessage: 'Error interno del connector.',
      recommendedAction: '',
      retryable: false,
      timestamp: Date.now(),
    };
  }
}

// Singleton
let connectorInstance: EtecsaConnector | null = null;

export function getEtecsaConnector(): EtecsaConnector {
  if (connectorInstance === null) {
    connectorInstance = new EtecsaConnector();
  }
  return connectorInstance;
}

export function resetEtecsaConnector(): void {
  connectorInstance = null;
}
