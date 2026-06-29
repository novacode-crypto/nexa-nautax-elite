/**
 * NEXA NautaX — useDashboardData
 *
 * Hook para el dashboard:
 *  - Estado de la sesión activa (lee de chrome.storage y reacciona a cambios)
 *  - Estado del portal ETECSA (probe)
 *  - Tiempo restante real (consulta al SessionManager)
 *  - Saldo real (consulta al SessionManager)
 *  - Tendencia de saldo (compara con saldo al inicio)
 *  - Modo demo (datos simulados para ver el dashboard sin conexión real)
 *
 * Se suscribe a chrome.storage.onChanged para detectar cuando la sesión
 * cambia desde el popup (login/logout) sin necesidad de refrescar manualmente.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { messageClient, type SessionSummary } from '@/modules/messaging/messageClient';
import { STORAGE_KEYS } from '@/storage/namespaces';
import { useSettingsStore } from '@/store/settingsStore';

export type PortalStatus = 'ONLINE' | 'CAPTIVE_PORTAL' | 'OFFLINE' | 'UNKNOWN';

export interface BalanceInfo {
  readonly amount: number;
  readonly currency: string;
  readonly trend: 'up' | 'down' | 'stable' | 'unknown';
  readonly trendPercent: number | null;
}

export interface MonthlyStats {
  /** Número de sesiones cerradas en el mes actual */
  readonly sessionsCount: number;
  /** Tiempo total en segundos */
  readonly totalSeconds: number;
  /** Tiempo formateado compacto: "18h 32m" */
  readonly totalTimeFormatted: string;
  /** Consumo total en CUP */
  readonly consumedAmount: number;
  /** Consumo formateado: "$54.20" */
  readonly consumedFormatted: string;
}

export interface DaySessionDetail {
  readonly alias: string;
  readonly startTime: string; // "14:32"
  readonly duration: string;  // "1h 23m"
  readonly consumed: string;  // "$2.50"
}

export type RecentSessionStatus = 'completed' | 'interrupted' | 'error';

export interface VisitedUrl {
  readonly url: string;
  readonly title: string;
  readonly domain: string;
  readonly visitTime: number;       // timestamp
  readonly visitTimeFormatted: string; // "14:35"
}

export interface RecentSession {
  readonly id: string;
  readonly alias: string;
  readonly avatar?: string | undefined;
  readonly username: string;
  readonly domain: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationSeconds: number;
  readonly durationFormatted: string;
  readonly balanceStart: number;
  readonly balanceEnd: number;
  readonly consumed: number;
  readonly consumedFormatted: string;
  readonly status: RecentSessionStatus;
  readonly statusReason?: string;
  readonly timeRange: string;
  readonly dateLabel: string;
  readonly visitedUrls?: readonly VisitedUrl[];
}

export interface DayStats {
  /** 0 = Lunes, 6 = Domingo */
  readonly dayIndex: number;
  readonly dayName: string;       // "Lun", "Mar", ...
  readonly dayNameFull: string;   // "Lunes", "Martes", ...
  readonly date: string;          // "23 Jun"
  readonly minutes: number;
  readonly sessionsCount: number;
  readonly sessions: readonly DaySessionDetail[];
}

export interface WeeklyStats {
  readonly days: readonly DayStats[];
  readonly totalMinutes: number;
  readonly maxMinutes: number;
}

export interface DashboardData {
  /** Sesión activa (null si no hay) */
  readonly session: SessionSummary | null;
  /** Estado del portal ETECSA */
  readonly portalStatus: PortalStatus;
  /** True mientras se está cargando la sesión inicial */
  readonly loadingSession: boolean;
  /** True mientras se está probing el portal */
  readonly loadingPortal: boolean;
  /** Refresca el estado del portal manualmente */
  readonly refreshPortal: () => Promise<void>;
  /** Error al probe (si hubo) */
  readonly portalError: string | null;
  /** True si hay conexión a internet (ONLINE) pero no tenemos sesión registrada → sesión externa */
  readonly externalSessionDetected: boolean;

  /** Tiempo restante en segundos (null si no se pudo obtener) */
  readonly timeRemainingSeconds: number | null;
  /** Tiempo restante formateado HH:MM:SS (null si no aplica) */
  readonly timeRemainingFormatted: string | null;
  /** True mientras se está consultando el tiempo restante */
  readonly loadingTimeRemaining: boolean;
  /** Refresca el tiempo restante manualmente */
  readonly refreshTimeRemaining: () => Promise<void>;

  /** Saldo actual (null si no se pudo obtener) */
  readonly balance: BalanceInfo | null;
  /** True mientras se está consultando el saldo */
  readonly loadingBalance: boolean;
  /** Refresca el saldo manualmente */
  readonly refreshBalance: () => Promise<void>;

  /** Estadísticas mensuales (null si no hay datos) */
  readonly monthlyStats: MonthlyStats | null;
  /** True mientras se están cargando las estadísticas */
  readonly loadingStats: boolean;
  /** Refresca las estadísticas manualmente */
  readonly refreshStats: () => Promise<void>;

  /** Estadísticas semanales (null si no hay datos) */
  readonly weeklyStats: WeeklyStats | null;
  /** True mientras se están cargando las estadísticas semanales */
  readonly loadingWeekly: boolean;

  /** Últimas sesiones cerradas (array vacío si no hay) */
  readonly recentSessions: readonly RecentSession[];
  /** True mientras se están cargando las últimas sesiones */
  readonly loadingRecent: boolean;
  /** Refresca las últimas sesiones manualmente */
  readonly refreshRecent: () => Promise<void>;

  /** Modo demo activado */
  readonly demoMode: boolean;
}

// —— Datos demo ——
const DEMO_SESSION: SessionSummary = {
  accountId: 'demo-account-1',
  alias: 'pepe.perez',
  username: 'pepe.perez',
  domain: 'nauta.com.cu',
  startedAt: Date.now() - 23 * 60 * 1000 - 45 * 1000, // 23m 45s atrás
  totalSeconds: 3600, // 1 hora
};

const DEMO_BALANCE: BalanceInfo = {
  amount: 25.50,
  currency: 'CUP',
  trend: 'up',
  trendPercent: 12,
};

const DEMO_STATS: MonthlyStats = {
  sessionsCount: 12,
  totalSeconds: 18 * 3600 + 32 * 60, // 18h 32m
  totalTimeFormatted: '18h 32m',
  consumedAmount: 54.20,
  consumedFormatted: '$54.20',
};

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function makeDemoDay(targetDayOfWeek: number, minutes: number, sessions: Array<[string, string, string, string]>): DayStats {
  // targetDayOfWeek: 0=Dom, 1=Lun, ..., 6=Sáb
  // Calcula la fecha real de ese día en la semana actual (hacia atrás desde hoy)
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  let diff = todayDayOfWeek - targetDayOfWeek;
  if (diff < 0) diff += 7; // si el día objetivo ya pasó esta semana, ir a la semana anterior
  const dayDate = new Date(today);
  dayDate.setDate(today.getDate() - diff);
  const dateStr = dayDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return {
    dayIndex: targetDayOfWeek,
    dayName: DAY_NAMES_SHORT[targetDayOfWeek]!,
    dayNameFull: DAY_NAMES_FULL[targetDayOfWeek]!,
    date: dateStr,
    minutes,
    sessionsCount: sessions.length,
    sessions: sessions.map(([alias, startTime, duration, consumed]) => ({
      alias, startTime, duration, consumed,
    })),
  };
}

// Genera 20 sesiones para un día (para probar el scroll del modal)
function make20Sessions(): Array<[string, string, string, string]> {
  const sessions: Array<[string, string, string, string]> = [];
  const aliases = ['pepe.perez', 'trabajo', 'casa'];
  for (let i = 0; i < 20; i++) {
    const hour = Math.floor(i * 1.2); // sesiones cada ~72 min
    const minute = (i * 12) % 60;
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const duration = `${15 + (i % 4) * 10}m`; // 15, 25, 35, 45 min rotando
    const consumed = `$${((15 + (i % 4) * 10) * 0.025).toFixed(2)}`;
    sessions.push([aliases[i % 3]!, startTime, duration, consumed]);
  }
  return sessions;
}

const DEMO_WEEKLY: WeeklyStats = (() => {
  // Orden Cuba: Dom(0), Lun(1), Mar(2), Mié(3), Jue(4), Vie(5), Sáb(6)
  const days: DayStats[] = [
    makeDemoDay(0, 45, [['pepe.perez', '09:15', '45m', '$1.20']]),
    makeDemoDay(1, 95, [['trabajo', '14:00', '1h 35m', '$3.80']]),
    makeDemoDay(2, 0, []),
    makeDemoDay(3, 120, [['pepe.perez', '10:30', '2h 00m', '$4.50']]),
    makeDemoDay(4, 60, [['trabajo', '16:00', '1h 00m', '$2.20']]),
    makeDemoDay(5, 180, [
      ['pepe.perez', '08:00', '2h 00m', '$4.80'],
      ['trabajo', '20:00', '1h 00m', '$2.20'],
    ]),
    // Sábado con 20 sesiones para probar el scroll del modal
    makeDemoDay(6, 600, make20Sessions()),
  ];
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);
  return { days, totalMinutes, maxMinutes };
})();

function formatHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatTimeOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  if (timestamp >= todayStart) return 'Hoy';
  if (timestamp >= yesterdayStart) return 'Ayer';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// —— Datos demo: últimas sesiones ——
const DEMO_RECENT_SESSIONS: RecentSession[] = (() => {
  const now = Date.now();

  // Genera URLs demo visitadas durante una sesión
  const demoUrls = [
    { domain: 'google.com', title: 'Google — Buscar', path: '/search?q=nauta+cuba' },
    { domain: 'facebook.com', title: 'Facebook', path: '/' },
    { domain: 'whatsapp.com', title: 'WhatsApp Web', path: '/' },
    { domain: 'youtube.com', title: 'YouTube — Música cubana', path: '/watch?v=demo123' },
    { domain: 'wikipedia.org', title: 'Wikipedia — ETECSA', path: '/wiki/ETECSA' },
    { domain: 'gmail.com', title: 'Gmail — Bandeja de entrada', path: '/' },
    { domain: 'twitter.com', title: 'Twitter / X', path: '/home' },
    { domain: 'instagram.com', title: 'Instagram', path: '/' },
    { domain: 'github.com', title: 'GitHub — NEXA NautaX', path: '/nexa/nautax' },
    { domain: 'cubadebate.cu', title: 'Cubadebate — Noticias', path: '/' },
    { domain: 'ecured.cu', title: 'EcuRed — Enciclopedia cubana', path: '/Portada' },
    { domain: 'revolico.com', title: 'Revolico — Clasificados', path: '/' },
    { domain: 'porlalivre.com', title: 'PorLaLibre — Anuncios', path: '/' },
    { domain: 'adslcoverage.net', title: 'Speed Test', path: '/speedtest' },
    { domain: 'translate.google.com', title: 'Google Translate', path: '/?sl=es&tl=en' },
  ];

  const generateVisitedUrls = (startedAt: number, durationSec: number, count: number): VisitedUrl[] => {
    const urls: VisitedUrl[] = [];
    for (let i = 0; i < count; i++) {
      const demoUrl = demoUrls[i % demoUrls.length]!;
      const visitTime = startedAt + Math.floor((durationSec / count) * i * 1000) + Math.floor(Math.random() * 60000);
      urls.push({
        url: `https://${demoUrl.domain}${demoUrl.path}`,
        title: demoUrl.title,
        domain: demoUrl.domain,
        visitTime,
        visitTimeFormatted: formatTimeOnly(visitTime),
      });
    }
    return urls.sort((a, b) => b.visitTime - a.visitTime); // más recientes primero
  };

  const sessions: Array<{
    alias: string; username: string; domain: string;
    startedAt: number; durationSec: number; balanceStart: number; balanceEnd: number;
    status: RecentSessionStatus; statusReason?: string; urlCount: number;
  }> = (() => {
    // Genera 25 sesiones distribuidas en los últimos 30 días
    const aliases = [
      { alias: 'pepe.perez', username: 'pepe.perez' },
      { alias: 'trabajo', username: 'trabajo.admin' },
      { alias: 'casa', username: 'familia.perez' },
    ];
    const statuses: Array<{ status: RecentSessionStatus; reason: string }> = [
      { status: 'completed', reason: 'Sesión cerrada manualmente' },
      { status: 'completed', reason: 'Sesión cerrada manualmente' },
      { status: 'completed', reason: 'Sesión cerrada manualmente' },
      { status: 'completed', reason: 'Desconexión automática por tiempo' },
      { status: 'interrupted', reason: 'Conexión perdida con ETECSA' },
      { status: 'error', reason: 'Error de autenticación al cerrar sesión' },
    ];

    const result: Array<{
      alias: string; username: string; domain: string;
      startedAt: number; durationSec: number; balanceStart: number; balanceEnd: number;
      status: RecentSessionStatus; statusReason?: string; urlCount: number;
    }> = [];

    for (let i = 0; i < 25; i++) {
      const acc = aliases[i % aliases.length]!;
      const statusInfo = statuses[i % statuses.length]!;
      // Distribuir sesiones: 1ra hace 1h, 2da hace 3h, 3ra hace 8h, etc.
      const hoursAgo = 1 + i * 7 + (i % 3) * 2;
      const startedAt = now - hoursAgo * 60 * 60 * 1000;
      const durationSec = (15 + (i % 8) * 20) * 60; // 15m, 35m, 55m, ... hasta 2h 35m
      const balanceStart = 20 + (i % 5) * 5; // 20, 25, 30, 35, 40
      const consumed = (durationSec / 60) * 0.025;
      const balanceEnd = Math.max(0, balanceStart - consumed);
      const urlCount = 2 + (i % 15); // 2 a 16 URLs

      result.push({
        alias: acc.alias,
        username: acc.username,
        domain: 'nauta.com.cu',
        startedAt,
        durationSec,
        balanceStart,
        balanceEnd,
        status: statusInfo.status,
        statusReason: statusInfo.reason,
        urlCount,
      });
    }

    return result;
  })();
  return sessions.map((s, i) => {
    const endedAt = s.startedAt + s.durationSec * 1000;
    const consumed = s.balanceStart - s.balanceEnd;
    const visitedUrls = generateVisitedUrls(s.startedAt, s.durationSec, s.urlCount);
    return {
      id: `demo-recent-${i}`,
      alias: s.alias,
      username: s.username,
      domain: s.domain,
      startedAt: s.startedAt,
      endedAt,
      durationSeconds: s.durationSec,
      durationFormatted: formatDuration(s.durationSec),
      balanceStart: s.balanceStart,
      balanceEnd: s.balanceEnd,
      consumed,
      consumedFormatted: `-$${consumed.toFixed(2)}`,
      status: s.status,
      ...(s.statusReason ? { statusReason: s.statusReason } : {}),
      timeRange: `${formatTimeOnly(s.startedAt)} - ${formatTimeOnly(endedAt)}`,
      dateLabel: formatDateLabel(s.startedAt),
      visitedUrls,
    } as RecentSession;
  });
})();

export function useDashboardData(): DashboardData {
  // demoMode viene directo del settingsStore (single source of truth)
  const demoMode = useSettingsStore((s) => s.settings.developer.demoMode);

  const [session, setSession] = useState<SessionSummary | null>(null);
  const [portalStatus, setPortalStatus] = useState<PortalStatus>('UNKNOWN');
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Tiempo restante
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null);
  const [loadingTimeRemaining, setLoadingTimeRemaining] = useState(false);

  // Saldo
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const balanceAtStartRef = useRef<number | null>(null);

  // Estadísticas mensuales
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Estadísticas semanales
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  // Últimas sesiones
  const [recentSessions, setRecentSessions] = useState<readonly RecentSession[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // —— Cargar sesión inicial (real) ——
  const loadSessionReal = useCallback(async () => {
    const r = await messageClient.sessionGetState();
    if (r.ok) {
      setSession(r.data);
    }
    setLoadingSession(false);
  }, []);

  // —— Probe del portal ——
  const refreshPortal = useCallback(async () => {
    if (demoMode) {
      setPortalStatus('ONLINE');
      return;
    }
    setLoadingPortal(true);
    setPortalError(null);
    try {
      const r = await messageClient.connectionProbe();
      if (r.ok && r.data) {
        setPortalStatus(r.data.state as PortalStatus);
      } else {
        setPortalStatus('UNKNOWN');
        setPortalError(r.ok ? null : r.error.userMessage);
      }
    } catch {
      setPortalStatus('UNKNOWN');
      setPortalError('No se pudo verificar el estado del portal');
    } finally {
      setLoadingPortal(false);
    }
  }, [demoMode]);

  // —— Tiempo restante real ——
  // SessionManager no expone getTimeRemaining vía messageClient todavía,
  // así que lo calculamos localmente desde startedAt + totalSeconds.
  // Si totalSeconds es null (no viene de ETECSA), mostramos null.
  const refreshTimeRemaining = useCallback(async () => {
    if (demoMode) {
      if (DEMO_SESSION.totalSeconds && DEMO_SESSION.startedAt) {
        const elapsed = Math.floor((Date.now() - DEMO_SESSION.startedAt) / 1000);
        setTimeRemainingSeconds(Math.max(0, DEMO_SESSION.totalSeconds - elapsed));
      }
      return;
    }
    if (!session) {
      setTimeRemainingSeconds(null);
      return;
    }
    setLoadingTimeRemaining(true);
    try {
      // TODO: getTimeRemaining via messageClient
      // Por ahora calculamos localmente.
      if (session.totalSeconds != null) {
        const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
        setTimeRemainingSeconds(Math.max(0, session.totalSeconds - elapsed));
      } else {
        setTimeRemainingSeconds(null);
      }
    } catch {
      setTimeRemainingSeconds(null);
    } finally {
      setLoadingTimeRemaining(false);
    }
  }, [demoMode, session]);

  // —— Saldo real ——
  // SessionManager.getBalance() existe pero no está expuesto vía messageClient.
  // Por ahora usamos null hasta que se implemente el handler SESSION_GET_BALANCE.
  // En modo demo, usamos DEMO_BALANCE.
  const refreshBalance = useCallback(async () => {
    if (demoMode) {
      setBalance(DEMO_BALANCE);
      return;
    }
    if (!session) {
      setBalance(null);
      balanceAtStartRef.current = null;
      return;
    }
    setLoadingBalance(true);
    try {
      // TODO: SESSION_GET_BALANCE
      // const r = await messageClient.sessionGetBalance();
      // if (r.ok && r.data) {
      //   const currentAmount = r.data.amount;
      //   if (balanceAtStartRef.current === null) balanceAtStartRef.current = currentAmount;
      //   const start = balanceAtStartRef.current;
      //   const diff = currentAmount - start;
      //   const percent = start > 0 ? (diff / start) * 100 : 0;
      //   setBalance({
      //     amount: currentAmount,
      //     currency: r.data.currency,
      //     trend: diff > 0.01 ? 'up' : diff < -0.01 ? 'down' : 'stable',
      //     trendPercent: Math.abs(percent) < 0.1 ? 0 : Math.round(percent * 10) / 10,
      //   });
      // } else {
      //   setBalance(null);
      // }
      setBalance(null); // placeholder hasta implementar SESSION_GET_BALANCE
    } catch {
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [demoMode, session]);

  // —— Estadísticas mensuales + semanales ——
  // Requiere HistoryRepository para datos reales.
  const refreshStats = useCallback(async () => {
    if (demoMode) {
      setMonthlyStats(DEMO_STATS);
      setWeeklyStats(DEMO_WEEKLY);
      return;
    }
    if (!session) {
      setMonthlyStats(null);
      setWeeklyStats(null);
      return;
    }
    setLoadingStats(true);
    setLoadingWeekly(true);
    try {
      // TODO: HISTORY_GET_MONTHLY_STATS + HISTORY_GET_WEEKLY_STATS
      setMonthlyStats(null);
      setWeeklyStats(null);
    } catch {
      setMonthlyStats(null);
      setWeeklyStats(null);
    } finally {
      setLoadingStats(false);
      setLoadingWeekly(false);
    }
  }, [demoMode, session]);

  // —— Últimas sesiones ——
  // Requiere HistoryRepository para datos reales.
  const refreshRecent = useCallback(async () => {
    if (demoMode) {
      setRecentSessions(DEMO_RECENT_SESSIONS);
      return;
    }
    if (!session) {
      setRecentSessions([]);
      return;
    }
    setLoadingRecent(true);
    try {
      // TODO: HISTORY_GET_RECENT
      setRecentSessions([]);
    } catch {
      setRecentSessions([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [demoMode, session]);

  // —— Reaccionar a cambios de demoMode (desde el store) ——
  // Cuando demoMode cambia, cargar o limpiar datos demo
  useEffect(() => {
    if (demoMode) {
      setSession(DEMO_SESSION);
      setPortalStatus('ONLINE');
      setLoadingSession(false);
      const elapsed = Math.floor((Date.now() - DEMO_SESSION.startedAt) / 1000);
      setTimeRemainingSeconds(Math.max(0, (DEMO_SESSION.totalSeconds ?? 0) - elapsed));
      setBalance(DEMO_BALANCE);
      balanceAtStartRef.current = 22.00;
      setMonthlyStats(DEMO_STATS);
      setWeeklyStats(DEMO_WEEKLY);
      setRecentSessions(DEMO_RECENT_SESSIONS);
    } else {
      // Al desactivar demo, limpiar y cargar datos reales
      setSession(null);
      setPortalStatus('UNKNOWN');
      setTimeRemainingSeconds(null);
      setBalance(null);
      balanceAtStartRef.current = null;
      setMonthlyStats(null);
      setWeeklyStats(null);
      setRecentSessions([]);
      setLoadingSession(true);
      void loadSessionReal();
      void refreshPortal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  // —— Init: cargar sesión + probe (si no es demo) ——
  useEffect(() => {
    if (demoMode) return;
    void loadSessionReal();
    void refreshPortal();
  }, [demoMode, loadSessionReal, refreshPortal]);

  // —— Cuando cambia la sesión, cargar tiempo restante + saldo + stats ——
  useEffect(() => {
    if (!session) {
      setTimeRemainingSeconds(null);
      setBalance(null);
      balanceAtStartRef.current = null;
      setMonthlyStats(null);
      setWeeklyStats(null);
      setRecentSessions([]);
      return;
    }
    void refreshTimeRemaining();
    void refreshBalance();
    void refreshStats();
    void refreshRecent();
  }, [session, refreshTimeRemaining, refreshBalance, refreshStats, refreshRecent]);

  // —— Suscripción a cambios en chrome.storage.local (sesión real) ——
  useEffect(() => {
    if (demoMode) return;
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.SESSION_ACTIVE in changes) {
        const change = changes[STORAGE_KEYS.SESSION_ACTIVE];
        if (change?.newValue) {
          const s = change.newValue as SessionSummary;
          setSession(s);
        } else if (change?.oldValue && !change.newValue) {
          setSession(null);
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [demoMode]);

  // —— Auto-refresh del portal cada 30s (no en demo) ——
  useEffect(() => {
    if (demoMode) return;
    const interval = setInterval(() => {
      void refreshPortal();
    }, 30_000);
    return () => clearInterval(interval);
  }, [demoMode, refreshPortal]);

  // —— Auto-refresh de tiempo restante cada 1s (para el cronómetro) ——
  useEffect(() => {
    if (!session && !demoMode) return;
    const interval = setInterval(() => {
      void refreshTimeRemaining();
    }, 1000);
    return () => clearInterval(interval);
  }, [session, demoMode, refreshTimeRemaining]);

  // —— Auto-refresh de saldo cada 60s ——
  useEffect(() => {
    if (!session && !demoMode) return;
    const interval = setInterval(() => {
      void refreshBalance();
    }, 60_000);
    return () => clearInterval(interval);
  }, [session, demoMode, refreshBalance]);

  // Detectar sesión externa: ONLINE pero sin sesión nuestra (y no en demo)
  const externalSessionDetected = !demoMode && portalStatus === 'ONLINE' && session === null && !loadingSession;

  return {
    session,
    portalStatus,
    loadingSession,
    loadingPortal,
    refreshPortal,
    portalError,
    externalSessionDetected,
    timeRemainingSeconds,
    timeRemainingFormatted: timeRemainingSeconds !== null ? formatHHMMSS(timeRemainingSeconds) : null,
    loadingTimeRemaining,
    refreshTimeRemaining,
    balance,
    loadingBalance,
    refreshBalance,
    monthlyStats,
    loadingStats,
    refreshStats,
    weeklyStats,
    loadingWeekly,
    recentSessions,
    loadingRecent,
    refreshRecent,
    demoMode,
  };
}
