/**
 * NEXA NautaX — MockEtecsaConnector
 *  — Doc 2 §11
 *
 * Implementación mock de IEtecsaConnector para tests y desarrollo.
 * Permite probar la UI sin necesidad de conexión real a ETECSA.
 *
 * Simula:
 *  - Login con credenciales válidas/inválidas
 *  - Logout
 *  - Balance
 *  - Time remaining
 *  - Sesión expirada
 *  - Errores de red
 */

import type { AccountId } from '@/types/branded';
import { asAccountId, asAttributeUuid, asCsrfToken, asWlanUserIp } from '@/types/branded';
import type { IEtecsaConnector } from './contracts/IEtecsaConnector';
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
import { err, ok } from '@/modules/result/Result';

export interface MockOptions {
  readonly validUsername?: string;
  readonly validPassword?: string;
  readonly initialBalance?: number;
  readonly simulateDelay?: number; // ms
  readonly failNextLogin?: boolean;
  readonly portalStatus?: PortalStatus;
}

export class MockEtecsaConnector implements IEtecsaConnector {
  private readonly options: MockOptions;
  private session: SessionData | null = null;
  private balance: number;
  private readonly startedAt: number;

  constructor(options: MockOptions = {}) {
    this.options = {
      validUsername: 'pepe@nauta.com.cu',
      validPassword: '12345',
      initialBalance: 25.50,
      simulateDelay: 500,
      portalStatus: { kind: 'CAPTIVE_PORTAL', captivePortal: true },
      ...options,
    };
    this.balance = this.options.initialBalance!;
    this.startedAt = Date.now();
  }

  async login(req: LoginRequest): Promise<Result<LoginResponse, EtecsaError>> {
    await this.delay();

    if (this.options.failNextLogin) {
      return err(this.makeError('NETWORK_TIMEOUT', 'Simulated failure'));
    }

    if (req.username !== this.options.validUsername || req.password !== this.options.validPassword) {
      return err(this.makeError('AUTH_INVALID_CREDENTIALS', 'Mock: invalid credentials'));
    }

    if (this.balance <= 0) {
      return err(this.makeError('BALANCE_ZERO', 'Mock: zero balance'));
    }

    this.session = {
      accountId: asAccountId('mock_acc_001'),
      username: req.username,
      csrfToken: asCsrfToken('a'.repeat(32)),
      attributeUuid: asAttributeUuid('mock_attribute_uuid_001'),
      wlanUserIp: asWlanUserIp('10.15.20.30'),
      loggerId: 'mock_logger_id',
      startedAt: Date.now(),
      lastSync: Date.now(),
      cookies: { JSESSIONID: 'mock_session_id' },
      loginStrategy: 'KnownEndpoint',
    };

    return ok({ session: this.session });
  }

  async logout(_session: SessionData): Promise<Result<void, EtecsaError>> {
    await this.delay();
    this.session = null;
    return ok(undefined);
  }

  async getTimeRemaining(session: SessionData): Promise<Result<TimeRemainingResponse, EtecsaError>> {
    await this.delay();
    if (!this.session || this.session.attributeUuid !== session.attributeUuid) {
      return err(this.makeError('SESSION_NOT_FOUND', 'Mock: no active session'));
    }

    const elapsedMs = Date.now() - this.startedAt;
    const remainingMs = Math.max(0, 3600_000 - elapsedMs); // 1 hora simulada

    return ok({
      remaining: { ms: remainingMs },
      startedAt: this.startedAt,
      fetchedAt: Date.now(),
    });
  }

  async getBalance(session: SessionData, accountId: AccountId): Promise<Result<BalanceResponse, EtecsaError>> {
    await this.delay();
    if (!this.session || this.session.attributeUuid !== session.attributeUuid) {
      return err(this.makeError('SESSION_NOT_FOUND', 'Mock: no active session'));
    }

    return ok({
      accountId,
      amount: this.balance,
      currency: 'CUP',
      lastUpdated: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600_000, // 30 días
      estimatedTimeRemaining: { ms: (this.balance / 0.05) * 60_000 }, // ~0.05 CUP/min
    });
  }

  async getSessionInfo(
    session: SessionData,
    accountId: AccountId,
  ): Promise<Result<SessionInfoResponse, EtecsaError>> {
    await this.delay();

    const timeResult = await this.getTimeRemaining(session);
    if (!timeResult.ok) return timeResult;

    const balanceResult = await this.getBalance(session, accountId);
    if (!balanceResult.ok) return balanceResult;

    return ok({
      session,
      timeRemaining: timeResult.value.remaining,
      balance: balanceResult.value,
    });
  }

  async verifyCredentials(req: LoginRequest): Promise<Result<CredentialsVerification, EtecsaError>> {
    await this.delay();

    if (req.username !== this.options.validUsername || req.password !== this.options.validPassword) {
      return ok({
        valid: false,
        error: this.makeError('AUTH_INVALID_CREDENTIALS', 'Mock: invalid'),
      });
    }

    return ok({
      valid: true,
      balance: {
        accountId: asAccountId('mock_acc_001'),
        amount: this.balance,
        currency: 'CUP',
        lastUpdated: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 3600_000,
      },
    });
  }

  async probePortal(): Promise<Result<PortalStatus, EtecsaError>> {
    await this.delay();
    return ok(this.options.portalStatus!);
  }

  getHealth(): ConnectorHealth {
    return {
      lastOperation: null,
      lastSuccessAt: Date.now(),
      lastError: null,
      currentStrategy: 'KnownEndpoint',
      consecutiveFailures: 0,
      totalOperations: 0,
      totalSuccesses: 0,
      totalFailures: 0,
    };
  }

  // —— Helpers para tests ————————————————————————————————————————

  setBalance(amount: number): void {
    this.balance = amount;
  }

  setSession(session: SessionData | null): void {
    this.session = session;
  }

  getActiveSession(): SessionData | null {
    return this.session;
  }

  // —— Privados ————————————————————————————————————————————————

  private async delay(): Promise<void> {
    if (this.options.simulateDelay && this.options.simulateDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.simulateDelay));
    }
  }

  private makeError(code: EtecsaError['code'], technical: string): EtecsaError {
    return {
      code,
      category: this.categoryFor(code),
      technicalMessage: technical,
      userMessage: `Mock error: ${code}`,
      recommendedAction: 'Mock action',
      retryable: code !== 'AUTH_INVALID_CREDENTIALS' && code !== 'BALANCE_ZERO',
      timestamp: Date.now(),
    };
  }

  private categoryFor(code: EtecsaError['code']): EtecsaError['category'] {
    if (code.startsWith('AUTH_')) return 'AUTH_ERROR';
    if (code.startsWith('SESSION_')) return 'SESSION_ERROR';
    if (code.startsWith('NETWORK_') || code === 'PORTAL_UNREACHABLE') return 'NETWORK_ERROR';
    if (code.startsWith('CONNECTOR_')) return 'CONNECTOR_ERROR';
    if (code.startsWith('BALANCE_')) return 'BALANCE_ERROR';
    return 'UNKNOWN_ERROR';
  }
}
