/**
 * NEXA NautaX — HistoryRepository
 *
 * Almacena el historial de sesiones cerradas en chrome.storage.local.
 * Permite consultar últimas sesiones, estadísticas mensuales y semanales.
 */

import { STORAGE_KEYS } from '@/storage/namespaces';
import { getStorageDriver } from '@/storage/driver/chromeStorageDriver';

export interface HistoryEntry {
  readonly id: string;
  readonly accountId: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: string;
  readonly avatar?: string | undefined;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationSeconds: number;
  readonly balanceStart: number;
  readonly balanceEnd: number;
  readonly consumed: number;
  readonly status: 'completed' | 'interrupted' | 'error';
  readonly statusReason?: string;
}

export interface MonthlyStatsData {
  readonly sessionsCount: number;
  readonly totalSeconds: number;
  readonly consumedAmount: number;
}

export interface WeeklyDayData {
  readonly dayIndex: number;
  readonly date: string;
  readonly minutes: number;
  readonly sessionsCount: number;
  readonly sessions: readonly HistoryEntry[];
}

export interface WeeklyStatsData {
  readonly days: readonly WeeklyDayData[];
  readonly totalMinutes: number;
  readonly maxMinutes: number;
}

const MAX_HISTORY = 500;

class HistoryRepositoryImpl {
  private cache: HistoryEntry[] | null = null;

  async add(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
    const history = await this.list();

    // Deduplicación: si ya existe una entrada con el mismo accountId + startedAt (±5s), no añadir
    const exists = history.some(
      (h) => h.accountId === entry.accountId &&
             Math.abs(h.startedAt - entry.startedAt) < 5000
    );
    if (exists) return;

    const fullEntry: HistoryEntry = {
      ...entry,
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    history.unshift(fullEntry); // más recientes primero
    // Limitar historial
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    this.cache = history;
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.HISTORY, history);
  }

  async list(): Promise<HistoryEntry[]> {
    if (this.cache) return this.cache;
    const driver = getStorageDriver();
    const stored = await driver.getLocal<HistoryEntry[]>(STORAGE_KEYS.HISTORY);
    this.cache = stored ?? [];
    return this.cache;
  }

  async getRecent(limit: number = 25): Promise<HistoryEntry[]> {
    const history = await this.list();
    return history.slice(0, limit);
  }

  async getMonthlyStats(): Promise<MonthlyStatsData> {
    const history = await this.list();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const monthSessions = history.filter((h) => h.startedAt >= monthStart);
    const totalSeconds = monthSessions.reduce((sum, h) => sum + h.durationSeconds, 0);
    const consumedAmount = monthSessions.reduce((sum, h) => sum + h.consumed, 0);

    return {
      sessionsCount: monthSessions.length,
      totalSeconds,
      consumedAmount,
    };
  }

  async getWeeklyStats(): Promise<WeeklyStatsData> {
    const history = await this.list();
    const now = new Date();
    const todayDay = now.getDay(); // 0=Dom, 6=Sáb

    const days: WeeklyDayData[] = [];
    let totalMinutes = 0;
    let maxMinutes = 0;

    for (let i = 0; i < 7; i++) {
      // i=0 es Domingo (hace (todayDay) días), i=6 es Sábado (hoy si todayDay=6)
      const diff = todayDay - i;
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - diff);
      dayDate.setHours(0, 0, 0, 0);
      const dayStart = dayDate.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const daySessions = history.filter((h) => h.startedAt >= dayStart && h.startedAt < dayEnd);
      const minutes = daySessions.reduce((sum, h) => sum + Math.floor(h.durationSeconds / 60), 0);

      days.push({
        dayIndex: i,
        date: dayDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        minutes,
        sessionsCount: daySessions.length,
        sessions: daySessions,
      });

      totalMinutes += minutes;
      if (minutes > maxMinutes) maxMinutes = minutes;
    }

    return { days, totalMinutes, maxMinutes };
  }

  async clear(): Promise<void> {
    this.cache = [];
    const driver = getStorageDriver();
    await driver.removeLocal(STORAGE_KEYS.HISTORY);
  }

  async deduplicate(): Promise<void> {
    const history = await this.list();
    const seen = new Set<string>();
    const unique = history.filter((h) => {
      const key = `${h.accountId}_${h.startedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length !== history.length) {
      this.cache = unique;
      const driver = getStorageDriver();
      await driver.setLocal(STORAGE_KEYS.HISTORY, unique);
    }
  }

  async count(): Promise<number> {
    const history = await this.list();
    return history.length;
  }
}

export const historyRepository = new HistoryRepositoryImpl();
