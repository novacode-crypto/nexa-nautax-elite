/**
 * NEXA NautaX — ETECSA Connector Interface
 * Fase 1 — Doc 2 §2.6
 *
 * La única frontera entre NEXA NautaX y ETECSA.
 * Implementaciones: EtecsaConnector (real), MockEtecsaConnector (tests).
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
} from './types';
import type { Result } from '@/modules/result/Result';

export interface IEtecsaConnector {
  // —— Operaciones de conexión ——
  login(req: LoginRequest): Promise<Result<LoginResponse, EtecsaError>>;
  logout(session: SessionData): Promise<Result<void, EtecsaError>>;

  // —— Consultas de sesión activa ——
  getTimeRemaining(session: SessionData): Promise<Result<TimeRemainingResponse, EtecsaError>>;
  getBalance(session: SessionData, accountId: AccountId): Promise<Result<BalanceResponse, EtecsaError>>;
  getSessionInfo(session: SessionData, accountId: AccountId): Promise<Result<SessionInfoResponse, EtecsaError>>;

  // —— Utilidades ——
  verifyCredentials(req: LoginRequest): Promise<Result<CredentialsVerification, EtecsaError>>;
  probePortal(): Promise<Result<PortalStatus, EtecsaError>>;

  // —— Health / Developer Mode ——
  getHealth(): ConnectorHealth;
}

// Re-export types for convenience
export type {
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
} from './types';
export type { Result } from '@/modules/result/Result';
