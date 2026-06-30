/**
 * NEXA NautaX — SessionManager
 *  
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
import { historyRepository } from '@/storage/repositories/HistoryRepository';
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

    const session = this.activeSession;
    const connector = getEtecsaConnector();

    // Intentar logout HTTP (no bloquear si falla)
    let status: 'completed' | 'interrupted' | 'error' = 'completed';
    let statusReason: string | undefined;

    try {
      await connector.logout(session.sessionData);
    } catch (e) {
      status = 'error';
      statusReason = e instanceof Error ? e.message : 'Error al cerrar sesión en ETECSA';
    }

    // Guardar en historial
    try {
      const endedAt = Date.now();
      const durationSeconds = Math.floor((endedAt - session.startedAt) / 1000);

      // Intentar obtener saldo final
      let balanceEnd = 0;
      try {
        const balanceResult = await connector.getBalance(session.sessionData, session.accountId as never);
        if (balanceResult.ok) {
          balanceEnd = balanceResult.value.amount;
        }
      } catch {
        // Si falla, asumir 0
      }

      await historyRepository.add({
        accountId: session.accountId,
        alias: session.alias,
        username: session.username,
        domain: session.domain,
        ...(session.avatar ? { avatar: session.avatar } : {}),
        startedAt: session.startedAt,
        endedAt,
        durationSeconds,
        balanceStart: 0, // No tracking de saldo inicial por ahora
        balanceEnd,
        consumed: 0,
        status,
        ...(statusReason ? { statusReason } : {}),
      });
    } catch {
      // Si falla el historial, no bloquear el logout
    }

    // Limpiar estado local
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

    // Guardar totalSeconds actualizado en storage para que popup y sidebar se sincronicen
    const updatedSession = { ...session, totalSeconds };
    this.activeSession = updatedSession;
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.SESSION_ACTIVE, updatedSession);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  async getBalance(): Promise<{ amount: number; currency: string } | null> {
    const session = await this.getActiveSession();
    if (!session) return null;

    // Leer cookies de ETECSA con chrome.cookies API
    let cookieHeader = '';
    try {
      const cookies = await chrome.cookies.getAll({ url: 'https://secure.etecsa.net:8443' });
      cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      console.log('[NEXA] getBalance: cookies found =', cookies.length, cookieHeader.slice(0, 100));
    } catch (e) {
      console.error('[NEXA] getBalance: cannot read cookies:', e);
      return null;
    }

    if (!cookieHeader) {
      console.log('[NEXA] getBalance: no cookies found');
      return null;
    }

    // GET a la página principal con cookies manuales
    try {
      const response = await fetch('https://secure.etecsa.net:8443/', {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
        },
        credentials: 'omit', // No usar cookies del browser, usar las manuales
      });

      if (!response.ok) {
        console.error('[NEXA] getBalance: HTTP error:', response.status);
        return null;
      }

      const html = await response.text();
      console.log('[NEXA] getBalance: HTML length =', html.length);
      console.log('[NEXA] getBalance: HTML preview =', html.slice(0, 1000));

      // Si contiene formulario de login, no hay sesión
      if (html.includes('formulario') || html.includes('CSRFHW')) {
        console.log('[NEXA] getBalance: page contains login form');
        return null;
      }

      // Parsear saldo del HTML
      let amount = 0;

      // Patrón 1: "Saldo" seguido de números
      const match1 = html.match(/saldo[^0-9<>]*([\d]+[.,]?\d*)/i);
      if (match1) {
        amount = parseFloat(match1[1]!.replace(',', '.'));
        console.log('[NEXA] getBalance: found via pattern 1:', amount);
      }

      // Patrón 2: números seguidos de CUP
      if (amount === 0) {
        const match2 = html.match(/([\d]+[.,]?\d*)\s*(?:CUP|cup)/i);
        if (match2) {
          amount = parseFloat(match2[1]!.replace(',', '.'));
          console.log('[NEXA] getBalance: found via pattern 2:', amount);
        }
      }

      // Patrón 3: buscar en tablas con class saldo/balance/monto
      if (amount === 0) {
        const match3 = html.match(/(?:class=["'][^"']*(?:saldo|balance|monto)[^"']*["'][^>]*)>\s*([^<]*[\d]+)/i);
        if (match3 && match3[1]) {
          const numMatch = match3[1].match(/([\d]+[.,]?\d*)/);
          if (numMatch && numMatch[1]) {
            amount = parseFloat(numMatch[1].replace(',', '.'));
            console.log('[NEXA] getBalance: found via pattern 3:', amount);
          }
        }
      }

      // Patrón 4: cualquier número decimal XX.XX
      if (amount === 0) {
        const match4 = html.match(/([\d]+\.\d{2})/);
        if (match4) {
          amount = parseFloat(match4[1]!);
          console.log('[NEXA] getBalance: found via pattern 4:', amount);
        }
      }

      console.log('[NEXA] getBalance: final amount =', amount);

      if (amount > 0) {
        return { amount, currency: 'CUP' };
      }

      return null;
    } catch (e) {
      console.error('[NEXA] getBalance: fetch error:', e);
      return null;
    }
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
