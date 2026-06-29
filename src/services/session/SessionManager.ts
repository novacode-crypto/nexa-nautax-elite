/**
 * NEXA NautaX — SessionManager
 * Fase 7 — Implementación real
 *
 * Orquesta:
 *  - AccountManager (obtener cuenta, descifrar password)
 *  - ETECSA Connector (login/logout/probe real)
 *  - Storage (persistir sesión activa)
 *  - CryptoService (descifrar credenciales)
 */

import { STORAGE_KEYS } from '@/storage/namespaces';
import { getStorageDriver } from '@/storage/driver/chromeStorageDriver';
import { accountManager } from '@/services/accounts/AccountManager';
import { cryptoService } from '@/services/crypto/CryptoService';
import { getEtecsaConnector } from '@/connectors/etecsa';
import type { SessionData } from '@/connectors/etecsa/contracts/types';


export interface ActiveSession {
  readonly accountId: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: string;
  readonly avatar?: string | undefined;
  readonly startedAt: number;
  readonly sessionData: SessionData;
  readonly totalSeconds?: number | null;
}

class SessionManagerImpl {
  private activeSession: ActiveSession | null = null;

  // —— Login ————————————————————————————————————————————————

  async login(accountId: string): Promise<ActiveSession> {
    if (cryptoService.isLocked()) {
      throw new Error('Extensión bloqueada');
    }

    const account = await accountManager.getById(accountId);
    if (!account) throw new Error('Cuenta no encontrada');

    // Descifrar contraseña
    const password = await accountManager.getDecryptedPassword(accountId);
    const fullUsername = accountManager.getFullUsername(account);

    // Llamar al connector
    const connector = getEtecsaConnector();
    const result = await connector.login({
      username: fullUsername,
      password,
      accountType: 'prepaid',
    });

    if (!result.ok) {
      throw new Error(result.error.userMessage);
    }

    // Crear sesión activa
    const session: ActiveSession = {
      accountId: account.id,
      alias: account.alias,
      username: account.username,
      domain: account.domain,
      ...(account.avatar ? { avatar: account.avatar } : {}),
      startedAt: Date.now(),
      sessionData: result.value.session,
    };

    this.activeSession = session;
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SESSION_ACTIVE, session);

    // Marcar cuenta como usada
    await accountManager.markUsed(accountId);

    // Intentar obtener tiempo restante (no bloquear si falla)
    try {
      const timeResult = await connector.getTimeRemaining(result.value.session);
      if (timeResult.ok) {
        const totalSeconds = Math.floor(timeResult.value.remaining.ms / 1000);
        const sessionWithTime: ActiveSession = { ...session, totalSeconds };
        this.activeSession = sessionWithTime;
        await driver.setLocal(STORAGE_KEYS.SESSION_ACTIVE, sessionWithTime);
      }
    } catch {
      // Si falla, la sesión sigue activa sin tiempo total
    }

    return this.activeSession;
  }

  // —— Logout ————————————————————————————————————————————————

  async logout(): Promise<void> {
    if (!this.activeSession) {
      return;
    }

    const connector = getEtecsaConnector();
    await connector.logout(this.activeSession.sessionData);

    // Incluso si falla el logout HTTP, limpiar estado local
    this.activeSession = null;
    const driver = getStorageDriver();
    await driver.removeLocal(STORAGE_KEYS.SESSION_ACTIVE);
  }

  // —— Consultas ——————————————————————————————————————————————

  async getActiveSession(): Promise<ActiveSession | null> {
    if (this.activeSession) return this.activeSession;

    const driver = getStorageDriver();
    const stored = await driver.getLocal<ActiveSession>(STORAGE_KEYS.SESSION_ACTIVE);
    this.activeSession = stored;
    return stored;
  }

  async getTimeRemaining(): Promise<string | null> {
    const session = await this.getActiveSession();
    if (!session) return null;

    const connector = getEtecsaConnector();
    const result = await connector.getTimeRemaining(session.sessionData);
    if (!result.ok) return null;

    const totalSeconds = Math.floor(result.value.remaining.ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  async getBalance(): Promise<{ amount: number; currency: string } | null> {
    const session = await this.getActiveSession();
    if (!session) return null;

    const connector = getEtecsaConnector();
    const result = await connector.getBalance(session.sessionData, session.accountId as never);
    if (!result.ok) return null;

    return {
      amount: result.value.amount,
      currency: result.value.currency,
    };
  }

  // —— Probe ————————————————————————————————————————————————

  async probeConnection(): Promise<'ONLINE' | 'CAPTIVE_PORTAL' | 'OFFLINE'> {
    const connector = getEtecsaConnector();
    const result = await connector.probePortal();
    if (!result.ok) return 'OFFLINE';
    return result.value.kind;
  }
}

export const sessionManager = new SessionManagerImpl();
