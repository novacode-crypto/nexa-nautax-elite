/**
 * NEXA NautaX — Dashboard Overview (SidePanel) 
 *
 * Secciones:
 *  1. Status card — estado del portal ETECSA (informativo, sin acciones)
 *  2. Hero — sesión activa con cronómetro / empty state
 *  3. Stats principales — Tiempo restante + Saldo (grid 2 columnas)
 *  4. Estadísticas mensuales — Sesiones / Tiempo / Consumo (grid 3 columnas)
 *  5. Gráfico de consumo semanal — barras por día
 *  6. Últimas sesiones — lista de las últimas 5
 *  7. Botón "Ver historial completo"
 *
 * Modo demo: toggle en la esquina superior derecha.
 * Sin botones de acción (las acciones van en el popup).
 */

import { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Globe,
  RefreshCw,
  Clock,
  AlertTriangle,
  Activity,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  FlaskConical,
  History,
  X,
  Calendar,
} from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaSelect } from '@/components/nexa/NexaSelect';
import { NexaEmptyState } from '@/components/nexa/NexaEmptyState';
import { TooltipPortal } from '@/components/nexa/TooltipPortal';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { useDashboardData, type PortalStatus, type WeeklyStats, type DayStats, type RecentSession, type VisitedUrl } from '@/features/dashboard/hooks/useDashboardData';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useToast } from '@/providers/ToastProvider';
import { useSettingsStore } from '@/store/settingsStore';

// —— Días de fallback para el modo demo del gráfico (cuando no hay weeklyStats real) ——
// Orden Cuba: Domingo primero
const DEMO_DAYS_FALLBACK: DayStats[] = (() => {
  const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const today = new Date();
  const todayDayOfWeek = today.getDay(); // 0=Dom, ..., 6=Sáb
  return dayNamesShort.map((name, i) => {
    let diff = todayDayOfWeek - i;
    if (diff < 0) diff += 7;
    const d = new Date(today);
    d.setDate(today.getDate() - diff);
    return {
      dayIndex: i,
      dayName: name,
      dayNameFull: dayNamesFull[i]!,
      date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      minutes: 0,
      sessionsCount: 0,
      sessions: [],
    };
  });
})();

export function DashboardOverview() {
  const {
    session,
    portalStatus,
    loadingSession,
    loadingPortal,
    refreshPortal,
    portalError,
    externalSessionDetected,
    timeRemainingSeconds,
    loadingTimeRemaining,
    refreshTimeRemaining,
    balance,
    loadingBalance,
    refreshBalance,
    monthlyStats,
    loadingStats,
    weeklyStats,
    loadingWeekly,
    recentSessions,
    loadingRecent,
    refreshRecent,
  } = useDashboardData();
  const timer = useSessionTimer(session?.startedAt ?? null, session?.totalSeconds ?? null);
  const toast = useToast();

  // —— Modo demo global (desde settings) ——
  const demoModeGlobal = useSettingsStore((s) => s.settings.developer.demoMode);

  // —— Estado demo manual para Tiempo/Saldo (clic avanza) ——
  // 0 = normal, 1 = warning (< 10 min), 2 = error (< 5 min), 3 = saldo bajo
  const [timeSaldoState, setTimeSaldoState] = useState(0);
  const timeSaldoActive = demoModeGlobal && timeSaldoState > 0;
  const timeSaldoLabel = ['Normal', 'Warning (<10 min)', 'Error (<5 min)', 'Saldo bajo'][timeSaldoState];
  const advanceTimeSaldo = () => {
    const next = (timeSaldoState + 1) % 4;
    setTimeSaldoState(next);
    toast.info(`Estado: ${['Normal', 'Warning (<10 min)', 'Error (<5 min)', 'Saldo bajo'][next]}`);
  };

  const forcedTimeRemaining: number | null = timeSaldoActive && timeSaldoState <= 2
    ? [3600, 480, 120][timeSaldoState] ?? null
    : timeRemainingSeconds;
  const forcedTimeRemainingFormatted: string | null = forcedTimeRemaining !== null
    ? `${String(Math.floor(forcedTimeRemaining / 3600)).padStart(2, '0')}:${String(Math.floor((forcedTimeRemaining % 3600) / 60)).padStart(2, '0')}:${String(forcedTimeRemaining % 60).padStart(2, '0')}`
    : null;
  const forcedBalance = timeSaldoActive && timeSaldoState === 3
    ? { amount: 2.50, currency: 'CUP', trend: 'down' as const, trendPercent: -45 }
    : balance;

  // —— Estado demo manual para Estadísticas mensuales (clic avanza) ——
  // 0 = normal, 1 = pocas sesiones, 2 = mucho consumo, 3 = sin actividad
  const [statsState, setStatsState] = useState(0);
  const statsActive = demoModeGlobal && statsState > 0;
  const statsLabel = ['Normal', 'Pocas sesiones', 'Mucho consumo', 'Sin actividad'][statsState];
  const advanceStats = () => {
    const next = (statsState + 1) % 4;
    setStatsState(next);
    toast.info(`Estado: ${['Normal', 'Pocas sesiones', 'Mucho consumo', 'Sin actividad'][next]}`);
  };

  const forcedStats = statsActive
    ? [
        { sessionsCount: 12, totalSeconds: 18 * 3600 + 32 * 60, totalTimeFormatted: '18h 32m', consumedAmount: 54.20, consumedFormatted: '$54.20' },
        { sessionsCount: 2, totalSeconds: 90 * 60, totalTimeFormatted: '1h 30m', consumedAmount: 4.50, consumedFormatted: '$4.50' },
        { sessionsCount: 28, totalSeconds: 45 * 3600, totalTimeFormatted: '45h 00m', consumedAmount: 187.50, consumedFormatted: '$187.50' },
        { sessionsCount: 0, totalSeconds: 0, totalTimeFormatted: '0m', consumedAmount: 0, consumedFormatted: '$0.00' },
      ][statsState] ?? monthlyStats
    : monthlyStats;

  // —— Estado demo manual para Gráfico semanal (clic avanza) ——
  // 0 = normal, 1 = bajo consumo, 2 = pico de consumo, 3 = sin actividad
  const [chartState, setChartState] = useState(0);
  const chartActive = demoModeGlobal && chartState > 0;
  const chartLabel = ['Normal', 'Bajo consumo', 'Pico de consumo', 'Sin actividad'][chartState];
  const advanceChart = () => {
    const next = (chartState + 1) % 4;
    setChartState(next);
    toast.info(`Estado: ${['Normal', 'Bajo consumo', 'Pico de consumo', 'Sin actividad'][next]}`);
  };

  // Datos forzados para el gráfico según el estado del loop
  // Orden Cuba: Dom(0), Lun(1), Mar(2), Mié(3), Jue(4), Vie(5), Sáb(6)
  const forcedWeekly: WeeklyStats | null = (() => {
    if (!demoModeGlobal) return weeklyStats;

    // Estado 0 (Normal): usar los datos reales del DEMO_WEEKLY (con 20 sesiones el Sábado)
    if (chartState === 0) return weeklyStats;

    // Estados 1-3: sobrescribir minutos pero preservar la estructura de días
    const baseDays = weeklyStats?.days ?? DEMO_DAYS_FALLBACK;
    const minutesSets = [
      null,                              // 0 = normal (no se usa, ya se retornó arriba)
      [10, 5, 0, 15, 8, 20, 0],         // 1 = bajo consumo
      [20, 15, 10, 5, 25, 30, 280],     // 2 = pico (Sábado 280min)
      [0, 0, 0, 0, 0, 0, 0],            // 3 = sin actividad
    ];
    const minutes = minutesSets[chartState]!;

    // Genera N sesiones para un día con muchos minutos (para probar el scroll del modal)
    const generateSessionsForMinutes = (mins: number, dayIndex: number) => {
      if (mins <= 0) return [];
      // Para el Sábado en estado Pico (280min), generar 20 sesiones
      if (chartState === 2 && dayIndex === 6) {
        const sessions: Array<{ alias: string; startTime: string; duration: string; consumed: string }> = [];
        const aliases = ['pepe.perez', 'trabajo', 'casa'];
        for (let i = 0; i < 20; i++) {
          const hour = Math.floor(i * 1.2);
          const minute = (i * 12) % 60;
          sessions.push({
            alias: aliases[i % 3]!,
            startTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            duration: `${Math.floor(mins / 20)}m`,
            consumed: `$${(mins * 0.025 / 20).toFixed(2)}`,
          });
        }
        return sessions;
      }
      // Para otros días: 1-2 sesiones según los minutos
      if (mins > 60) {
        return [
          { alias: 'pepe.perez', startTime: '08:00', duration: `${Math.floor(mins / 2)}m`, consumed: `$${(mins * 0.025).toFixed(2)}` },
          { alias: 'trabajo', startTime: '18:00', duration: `${Math.floor(mins / 2)}m`, consumed: `$${(mins * 0.025).toFixed(2)}` },
        ];
      }
      return [
        { alias: 'pepe.perez', startTime: '14:00', duration: `${mins}m`, consumed: `$${(mins * 0.025).toFixed(2)}` },
      ];
    };

    const days = baseDays.map((d, i) => {
      const dayMinutes = minutes[i]!;
      const sessions = generateSessionsForMinutes(dayMinutes, i);
      return {
        ...d,
        minutes: dayMinutes,
        sessionsCount: sessions.length,
        sessions,
      };
    });
    const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
    const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);
    return { days, totalMinutes, maxMinutes };
  })();

  // —— Estado demo manual para Últimas sesiones (clic avanza) ——
  // 0 = normal, 1 = pocas sesiones, 2 = con errores, 3 = vacío
  const [recentState, setRecentState] = useState(0);
  const recentActive = demoModeGlobal && recentState > 0;
  const recentLabel = ['Normal', 'Pocas sesiones', 'Con errores', 'Vacío'][recentState];
  const advanceRecent = () => {
    const next = (recentState + 1) % 4;
    setRecentState(next);
    toast.info(`Estado: ${['Normal', 'Pocas sesiones', 'Con errores', 'Vacío'][next]}`);
  };

  // Datos forzados para últimas sesiones según el estado del loop
  const forcedRecentSessions: readonly RecentSession[] = (() => {
    if (!recentActive) return recentSessions;
    if (recentState === 1) return recentSessions.slice(0, 2);
    if (recentState === 2) return recentSessions.map((s, i) =>
      i % 2 === 0 ? { ...s, status: 'error' as const, statusReason: 'Error de autenticación' } : { ...s, status: 'interrupted' as const, statusReason: 'Conexión perdida' }
    );
    if (recentState === 3) return [];
    return recentSessions;
  })();

  // —— Filtros de últimas sesiones ——
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('week');

  // Filtra por cuenta (el filtro de tiempo se aplica en el historial completo)
  const filteredRecent = forcedRecentSessions.filter((s) => {
    if (filterAccount !== 'all' && s.alias !== filterAccount) return false;
    return true;
  });

  // Lista de cuentas únicas para el filtro
  const uniqueAccounts = Array.from(new Set(forcedRecentSessions.map((s) => s.alias)));

  // —— Estado del modal de detalle del día + sesión + historial completo ——
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<RecentSession | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* —— Título —— */}
      <StaggerItem index={0}>
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight mb-1">Dashboard</h1>
          <p className="text-sm text-foreground-muted">
            Estado general de tu conexión Nauta.
          </p>
        </div>
      </StaggerItem>

      {/* —— Aviso modo demo global activo —— */}
      {demoModeGlobal && (
        <StaggerItem index={1}>
          <div
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              color: 'var(--accent)',
            }}
          >
            <FlaskConical size={12} className="flex-shrink-0" />
            <span>
              <strong>Modo demo activo.</strong> Click en los badges "Demo" de cada sección para cambiar de estado.
            </span>
          </div>
        </StaggerItem>
      )}

      {/* —— 1+2. Hero fusionado: Portal ETECSA + Sesión activa —— */}
      <StaggerItem index={2}>
        {loadingSession ? (
          <NexaCard padding="lg">
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
            </div>
          </NexaCard>
        ) : (
          <HeroCard
            portalStatus={portalStatus}
            loadingPortal={loadingPortal}
            portalError={portalError}
            onRefreshPortal={refreshPortal}
            session={session}
            elapsedFormatted={timer.elapsedFormatted}
            elapsedCompact={timer.elapsedCompact}
            externalSessionDetected={externalSessionDetected}
          />
        )}
      </StaggerItem>

      {/* —— 3. Stats principales: Tiempo restante + Saldo —— */}
      {session && (
        <StaggerItem index={3}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-display text-base font-semibold tracking-tight">Estado de la sesión</h2>
              {demoModeGlobal && (
                <button
                  type="button"
                  onClick={advanceTimeSaldo}
                  className="transition-all"
                  title={`Click para avanzar al siguiente estado. Actual: ${timeSaldoLabel}`}
                >
                  <NexaBadge
                    variant={timeSaldoActive ? 'primary' : 'outline'}
                    size="sm"
                    icon={<Activity size={10} />}
                  >
                    {timeSaldoActive ? `Demo · ${timeSaldoLabel}` : 'Demo'}
                  </NexaBadge>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TimeRemainingCard
                remainingFormatted={forcedTimeRemainingFormatted}
                remainingSeconds={forcedTimeRemaining}
                loading={loadingTimeRemaining}
                onRefresh={refreshTimeRemaining}
              />
              <BalanceCard
                balance={forcedBalance}
                loading={loadingBalance}
                onRefresh={refreshBalance}
              />
            </div>
          </div>
        </StaggerItem>
      )}

      {/* —— 4. Estadísticas mensuales —— */}
      {session && (
        <StaggerItem index={4}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-display text-base font-semibold tracking-tight">
                Estadísticas de uso
              </h2>
              {demoModeGlobal && (
                <button
                  type="button"
                  onClick={advanceStats}
                  className="transition-all"
                  title={`Click para avanzar al siguiente estado. Actual: ${statsLabel}`}
                >
                  <NexaBadge
                    variant={statsActive ? 'primary' : 'outline'}
                    size="sm"
                    icon={<Activity size={10} />}
                  >
                    {statsActive ? `Demo · ${statsLabel}` : 'Demo'}
                  </NexaBadge>
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatMiniCard
                icon={<TrendingUp size={14} />}
                value={forcedStats ? String(forcedStats.sessionsCount) : '—'}
                label="Sesiones"
                sublabel="este mes"
                state={
                  statsActive
                    ? statsState === 1 ? 'warning' : statsState === 3 ? 'muted' : 'normal'
                    : 'normal'
                }
              />
              <StatMiniCard
                icon={<Clock size={14} />}
                value={forcedStats ? forcedStats.totalTimeFormatted : '—'}
                label="Tiempo"
                sublabel="este mes"
                state={
                  statsActive
                    ? statsState === 1 ? 'warning' : statsState === 3 ? 'muted' : 'normal'
                    : 'normal'
                }
              />
              <StatMiniCard
                icon={<Wallet size={14} />}
                value={forcedStats ? forcedStats.consumedFormatted : '—'}
                label="Consumido"
                sublabel="este mes"
                state={
                  statsActive
                    ? statsState === 2 ? 'error' : statsState === 3 ? 'muted' : 'normal'
                    : 'normal'
                }
              />
            </div>
            {loadingStats && (
              <p className="text-[10px] text-foreground-muted mt-2 text-center">Cargando estadísticas...</p>
            )}
          </div>
        </StaggerItem>
      )}

      {/* —— 5. Gráfico de consumo semanal —— */}
      {session && (
        <StaggerItem index={5}>
          <NexaCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">
                Consumo semanal
              </p>
              <div className="flex items-center gap-2">
                {forcedWeekly && (
                  <span className="text-[10px] text-foreground-subtle font-mono">
                    {Math.floor(forcedWeekly.totalMinutes / 60)}h {forcedWeekly.totalMinutes % 60}m total
                  </span>
                )}
                {demoModeGlobal && (
                  <button
                    type="button"
                    onClick={advanceChart}
                    className="transition-all"
                    title={`Click para avanzar al siguiente estado. Actual: ${chartLabel}`}
                  >
                    <NexaBadge
                      variant={chartActive ? 'primary' : 'outline'}
                      size="sm"
                      icon={<Activity size={10} />}
                    >
                      {chartActive ? `Demo · ${chartLabel}` : 'Demo'}
                    </NexaBadge>
                  </button>
                )}
              </div>
            </div>

            {forcedWeekly ? (
              <WeeklyChart
                weekly={forcedWeekly}
                onDayClick={(day) => setSelectedDay(day)}
              />
            ) : (
              <div className="flex items-center justify-center h-20 text-xs text-foreground-muted">
                {loadingWeekly ? 'Cargando...' : 'Sin datos'}
              </div>
            )}

            <p className="text-[9px] text-foreground-subtle mt-2 text-center">
              Click en una barra para ver detalles del día
            </p>
          </NexaCard>
        </StaggerItem>
      )}

      {/* —— 6. Últimas sesiones —— */}
      {session && (
        <StaggerItem index={6}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-display text-base font-semibold tracking-tight">Últimas sesiones</h2>
              <div className="flex items-center gap-2">
                {filteredRecent.length > 0 && (
                  <NexaBadge variant="default" size="sm">{filteredRecent.length}</NexaBadge>
                )}
                {demoModeGlobal && (
                  <button
                    type="button"
                    onClick={advanceRecent}
                    className="transition-all"
                    title={`Click para avanzar al siguiente estado. Actual: ${recentLabel}`}
                  >
                    <NexaBadge
                      variant={recentActive ? 'primary' : 'outline'}
                      size="sm"
                      icon={<Activity size={10} />}
                    >
                      {recentActive ? `Demo · ${recentLabel}` : 'Demo'}
                    </NexaBadge>
                  </button>
                )}
              </div>
            </div>

            {/* Filtros */}
            {forcedRecentSessions.length > 0 && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {/* Filtro por cuenta */}
                <NexaSelect
                  value={filterAccount}
                  onChange={setFilterAccount}
                  placeholder="Todas las cuentas"
                  width={160}
                  options={[
                    { value: 'all', label: 'Todas las cuentas' },
                    ...uniqueAccounts.map((acc) => ({ value: acc, label: acc })),
                  ]}
                />

                {/* Filtro por tiempo */}
                <NexaSelect
                  value={filterTime}
                  onChange={setFilterTime}
                  width={130}
                  options={[
                    { value: 'week', label: 'Última semana' },
                    { value: 'month', label: 'Último mes' },
                    { value: 'year', label: 'Último año' },
                  ]}
                />

                {/* Botón refresh */}
                <button
                  type="button"
                  onClick={refreshRecent}
                  disabled={loadingRecent}
                  className="ml-auto p-1 rounded-md transition-colors"
                  style={{ color: 'var(--foreground-muted)' }}
                  aria-label="Actualizar últimas sesiones"
                  onMouseEnter={(e) => { if (!loadingRecent) e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--foreground-muted)'; }}
                >
                  <RefreshCw size={12} className={loadingRecent ? 'animate-spin' : ''} />
                </button>
              </div>
            )}

            {/* Lista de sesiones */}
            {filteredRecent.length > 0 ? (
              <div
                className="flex flex-col gap-1.5 overflow-y-auto"
                style={{ maxHeight: '400px', scrollbarWidth: 'thin', paddingRight: '4px' }}
              >
                {filteredRecent.map((s) => (
                  <RecentSessionRow
                    key={s.id}
                    session={s}
                    onClick={() => setSelectedSession(s)}
                  />
                ))}
              </div>
            ) : forcedRecentSessions.length === 0 ? (
              <NexaEmptyState
                icon={<History size={36} className="text-foreground-subtle" />}
                title="Sin sesiones aún"
                description="Aún no has cerrado sesiones. Conéctate por primera vez para empezar a construir tu historial."
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center py-6 text-center"
                style={{
                  backgroundColor: 'var(--background-glass)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                }}
              >
                <p className="text-xs text-foreground-muted">
                  No hay sesiones que coincidan con los filtros
                </p>
              </div>
            )}
          </div>
        </StaggerItem>
      )}

      {/* —— 7. Botón ver historial completo —— */}
      {session && (
        <StaggerItem index={7}>
          <NexaButton
            variant="secondary"
            fullWidth
            size="lg"
            icon={<History size={16} />}
            onClick={() => setShowFullHistory(true)}
          >
            Ver historial completo
          </NexaButton>
        </StaggerItem>
      )}

      {/* —— Modal de detalle del día —— */}
      <DayDetailModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />

      {/* —— Modal de detalle de sesión —— */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />

      {/* —— Modal de historial completo —— */}
      <FullHistoryModal
        open={showFullHistory}
        onClose={() => setShowFullHistory(false)}
        sessions={forcedRecentSessions}
        filterAccount={filterAccount}
        filterTime={filterTime}
        onSessionClick={(s) => {
          setShowFullHistory(false);
          setSelectedSession(s);
        }}
      />
    </div>
  );
}

// ═══ Hero fusionado: Portal ETECSA + Sesión ═══════════════════════════

interface HeroCardProps {
  readonly portalStatus: PortalStatus;
  readonly loadingPortal: boolean;
  readonly portalError: string | null;
  readonly onRefreshPortal: () => void;
  readonly session: {
    readonly alias: string;
    readonly username: string;
    readonly domain: string;
    readonly avatar?: string | undefined;
    readonly startedAt: number;
  } | null;
  readonly elapsedFormatted: string;
  readonly elapsedCompact: string;
  readonly externalSessionDetected: boolean;
}

function HeroCard({
  portalStatus,
  loadingPortal,
  portalError,
  onRefreshPortal,
  session,
  elapsedFormatted,
  elapsedCompact,
  externalSessionDetected,
}: HeroCardProps) {
  const portal = getPortalStatusConfig(portalStatus);

  return (
    <NexaCard padding="lg" glow={!!session} variant="gradient">
      {/* —— Zona superior: estado del portal ETECSA —— */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0"
            style={{
              backgroundColor: `${portal.color}15`,
              border: `1px solid ${portal.color}40`,
            }}
          >
            <portal.Icon
              size={16}
              style={{ color: portal.color }}
              className={portal.spin ? 'animate-pulse' : ''}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Globe size={11} style={{ color: 'var(--foreground-subtle)' }} />
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">
                Portal ETECSA
              </p>
            </div>
            <p className="text-sm font-semibold truncate" style={{ color: portal.color }}>
              {portal.label}
            </p>
            {portalError && (
              <p className="text-[10px] text-error truncate">{portalError}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <NexaBadge variant={portal.badgeVariant} size="sm">
            {portal.short}
          </NexaBadge>
          <button
            type="button"
            onClick={onRefreshPortal}
            disabled={loadingPortal}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            aria-label="Actualizar estado del portal"
            onMouseEnter={(e) => {
              if (!loadingPortal) e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--foreground-muted)';
            }}
          >
            <RefreshCw size={12} className={loadingPortal ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* —— Zona inferior: sesión activa o empty state —— */}
      {session ? (
        <ActiveSessionContent
          session={session}
          elapsedFormatted={elapsedFormatted}
          elapsedCompact={elapsedCompact}
        />
      ) : (
        <NoSessionContent portalStatus={portalStatus} externalSessionDetected={externalSessionDetected} />
      )}
    </NexaCard>
  );
}

// —— Contenido: sesión activa ————————————————————————————————————

function ActiveSessionContent({
  session,
  elapsedFormatted,
  elapsedCompact,
}: {
  readonly session: {
    readonly alias: string;
    readonly username: string;
    readonly domain: string;
    readonly avatar?: string | undefined;
    readonly startedAt: number;
  };
  readonly elapsedFormatted: string;
  readonly elapsedCompact: string;
}) {
  return (
    <>
      {/* Avatar centrado, más grande, con punto verde en esquina inferior izquierda */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative">
          {/* Halo glow detrás del avatar */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
            style={{
              background: 'var(--primary)',
              filter: 'blur(20px)',
              transform: 'scale(1.15)',
            }}
          />
          {/* Avatar */}
          {session.avatar ? (
            <img
              src={session.avatar}
              alt={session.alias}
              className="relative h-20 w-20 rounded-full object-cover"
              style={{
                border: '3px solid var(--border-strong)',
                boxShadow: 'var(--glow-primary)',
              }}
            />
          ) : (
            <div
              className="relative flex items-center justify-center h-20 w-20 rounded-full text-2xl font-bold"
              style={{
                background: 'var(--primary-gradient)',
                color: 'var(--primary-foreground)',
                border: '3px solid var(--border-strong)',
                boxShadow: 'var(--glow-primary)',
              }}
            >
              {session.alias.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Punto verde glowing en esquina inferior derecha */}
          <span
            className="absolute bottom-1 right-1 inline-flex h-4 w-4 rounded-full"
            style={{
              backgroundColor: 'var(--success)',
              border: '3px solid var(--bg-elevated-2)',
              boxShadow: '0 0 8px var(--success), 0 0 16px var(--success)',
            }}
          >
            <span
              className="absolute inset-0 rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: 'var(--success)' }}
            />
          </span>
        </div>

        {/* Alias centrado debajo del avatar */}
        <p className="text-base font-semibold text-foreground mt-3 truncate max-w-full">
          {session.alias}
        </p>
        {/* Usuario + dominio centrados */}
        <p className="text-xs text-foreground-muted font-mono truncate max-w-full">
          {session.username}@{session.domain}
        </p>
      </div>

      {/* Cronómetro en vivo */}
      <div
        className="rounded-xl p-4 text-center"
        style={{
          backgroundColor: 'var(--background-glass)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Clock size={12} style={{ color: 'var(--accent)' }} />
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">
            Tiempo de sesión
          </p>
        </div>
        <p
          className="text-display text-3xl font-bold font-mono tracking-tight"
          style={{
            backgroundImage: 'var(--gradient-text-primary)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {elapsedFormatted}
        </p>
        <p className="text-[10px] text-foreground-muted mt-1">
          {elapsedCompact} transcurridos
        </p>
      </div>
    </>
  );
}

// —— Contenido: sin sesión ———————————————————————————————————————

function NoSessionContent({
  portalStatus,
  externalSessionDetected,
}: {
  readonly portalStatus: PortalStatus;
  readonly externalSessionDetected: boolean;
}) {
  const canConnect = portalStatus === 'CAPTIVE_PORTAL';

  // Estado especial: sesión externa detectada — aviso informativo
  if (externalSessionDetected) {
    return (
      <div className="flex flex-col items-center text-center py-2">
        {/* Icono grande con halo glow */}
        <div className="relative mb-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
            style={{
              background: 'var(--warning)',
              filter: 'blur(20px)',
              transform: 'scale(1.2)',
            }}
          />
          <div
            className="relative flex items-center justify-center h-20 w-20 rounded-full"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '3px solid var(--warning)',
              boxShadow: '0 0 16px var(--warning)',
            }}
          >
            <Globe size={32} style={{ color: 'var(--warning)' }} />
          </div>
        </div>

        {/* Título + descripción */}
        <h3 className="text-display text-lg font-bold mb-1" style={{ color: 'var(--warning)' }}>
          Sesión externa detectada
        </h3>
        <p className="text-xs text-foreground-muted max-w-xs mb-4 leading-relaxed">
          Hay una conexión Nauta activa que no fue iniciada desde NEXA NautaX. Puede ser del portal cautivo de ETECSA, otra extensión u otro dispositivo.
        </p>

        {/* Aviso */}
        <div
          className="w-full flex items-start gap-2 p-3 rounded-lg text-xs"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
          }}
        >
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <span className="text-foreground-muted text-left">
            Tienes internet funcionando. Para conectar desde aquí, <strong style={{ color: 'var(--warning)' }}>desconéctate de ETECSA primero</strong> (desde el portal o el dispositivo donde iniciaste la sesión) y luego usa el botón Conectar del popup.
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <NexaEmptyState
        icon={<WifiOff size={48} className="text-foreground-subtle" />}
        title={canConnect ? 'Listo para conectar' : 'Sin sesión activa'}
        description={
          canConnect
            ? 'Estás en el portal cautivo de ETECSA. Abre el popup de la extensión para conectar tu cuenta.'
            : 'Abre el popup de la extensión para conectar una cuenta Nauta.'
        }
      />
      <div
        className="mt-2 flex items-start gap-2 p-3 rounded-lg text-xs"
        style={{
          backgroundColor: canConnect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(99, 102, 241, 0.05)',
          border: `1px solid ${canConnect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)'}`,
        }}
      >
        {canConnect ? (
          <Activity size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
        ) : (
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
        )}
        <span className="text-foreground-muted">
          {canConnect
            ? 'Estado del portal: captivo. La conexión debería funcionar al conectar.'
            : 'Las acciones de conexión se realizan desde el popup de la extensión.'}
        </span>
      </div>
    </>
  );
}

function getPortalStatusConfig(status: PortalStatus): {
  label: string;
  short: string;
  description: string;
  color: string;
  Icon: typeof Wifi;
  spin?: boolean;
  badgeVariant: 'success' | 'warning' | 'error' | 'default';
} {
  switch (status) {
    case 'ONLINE':
      return {
        label: 'En línea',
        short: 'ONLINE',
        description: 'Ya tienes internet funcionando.',
        color: 'var(--success)',
        Icon: Wifi,
        badgeVariant: 'success',
      };
    case 'CAPTIVE_PORTAL':
      return {
        label: 'Portal cautivo',
        short: 'PORTAL',
        description: 'Conectado al WiFi Nauta pero sin autenticar.',
        color: 'var(--warning)',
        Icon: WifiOff,
        spin: true,
        badgeVariant: 'warning',
      };
    case 'OFFLINE':
      return {
        label: 'Sin conexión',
        short: 'OFFLINE',
        description: 'No hay red disponible.',
        color: 'var(--error)',
        Icon: WifiOff,
        badgeVariant: 'error',
      };
    default:
      return {
        label: 'Verificando...',
        short: '—',
        description: 'Comprobando estado del portal.',
        color: 'var(--foreground-muted)',
        Icon: Globe,
        spin: true,
        badgeVariant: 'default',
      };
  }
}


// ═══ Stats principales ═══════════════════════════════════════════════

interface TimeRemainingCardProps {
  readonly remainingFormatted: string | null;
  readonly remainingSeconds: number | null;
  readonly loading: boolean;
  readonly onRefresh: () => Promise<void> | void;
}

function TimeRemainingCard({ remainingFormatted, remainingSeconds, loading, onRefresh }: TimeRemainingCardProps) {
  // Warning si < 10 min (600s), error si < 5 min (300s)
  const isWarning = remainingSeconds !== null && remainingSeconds <= 600 && remainingSeconds > 300;
  const isError = remainingSeconds !== null && remainingSeconds <= 300;

  const color = isError ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--primary)';
  const glow = isError
    ? '0 0 12px var(--error)'
    : isWarning
      ? '0 0 12px var(--warning)'
      : 'var(--glow-primary)';

  return (
    <NexaCard padding="md" glow={!isError && !isWarning}>
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0"
          style={{
            background: isError || isWarning ? color : 'var(--primary-gradient)',
            boxShadow: glow,
          }}
        >
          <Clock size={16} className="text-white" />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded-md transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
          aria-label="Actualizar tiempo restante"
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--foreground-muted)'; }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
        Tiempo restante
      </p>
      <p
        className={`text-display text-xl font-bold font-mono tracking-tight ${isError ? 'animate-pulse' : ''}`}
        style={{
          backgroundImage: isError || isWarning ? 'none' : 'var(--gradient-text-primary)',
          WebkitBackgroundClip: isError || isWarning ? 'unset' : 'text',
          backgroundClip: isError || isWarning ? 'unset' : 'text',
          WebkitTextFillColor: isError || isWarning ? color : 'transparent',
          color: isError || isWarning ? color : undefined,
        }}
      >
        {loading && remainingFormatted === null ? '...' : (remainingFormatted ?? '—')}
      </p>
      {isError && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--error)' }}>Queda muy poco tiempo</p>
      )}
      {isWarning && !isError && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--warning)' }}>Tiempo agotándose</p>
      )}
      {!isError && !isWarning && remainingSeconds !== null && (
        <p className="text-[10px] text-foreground-muted mt-0.5">
          {Math.floor(remainingSeconds / 60)} min restantes
        </p>
      )}
    </NexaCard>
  );
}

interface BalanceCardProps {
  readonly balance: {
    readonly amount: number;
    readonly currency: string;
    readonly trend: 'up' | 'down' | 'stable' | 'unknown';
    readonly trendPercent: number | null;
  } | null;
  readonly loading: boolean;
  readonly onRefresh: () => Promise<void> | void;
}

function BalanceCard({ balance, loading, onRefresh }: BalanceCardProps) {
  const hasData = balance !== null;
  const isLow = hasData && balance!.amount < 5;
  const TrendIcon = balance?.trend === 'up' ? TrendingUp : balance?.trend === 'down' ? ArrowUpRight : null;
  const trendLabel =
    balance?.trend === 'up' ? `+${balance.trendPercent ?? 0}%` :
    balance?.trend === 'down' ? `-${Math.abs(balance.trendPercent ?? 0)}%` :
    '—';

  return (
    <NexaCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0"
          style={{
            backgroundColor: isLow ? 'rgba(239, 68, 68, 0.1)' : 'var(--muted)',
            border: `1px solid ${isLow ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-strong)'}`,
          }}
        >
          <Wallet size={16} style={{ color: isLow ? 'var(--error)' : 'var(--accent)' }} />
        </div>
        {hasData && TrendIcon ? (
          <NexaBadge
            variant={balance!.trend === 'up' ? 'success' : balance!.trend === 'down' ? 'error' : 'default'}
            size="sm"
          >
            <span className="flex items-center gap-0.5">
              <TrendIcon size={9} /> {trendLabel}
            </span>
          </NexaBadge>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            aria-label="Actualizar saldo"
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--foreground-muted)'; }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
        Saldo
      </p>
      {loading && !hasData ? (
        <p className="text-display text-xl font-bold tracking-tight text-foreground-muted">...</p>
      ) : hasData ? (
        <p
          className="text-display text-xl font-bold tracking-tight"
          style={{ color: isLow ? 'var(--error)' : 'var(--foreground)' }}
        >
          ${balance!.amount.toFixed(2)}
          <span className="text-xs text-foreground-muted ml-1 font-medium">{balance!.currency}</span>
        </p>
      ) : (
        <p className="text-display text-xl font-bold tracking-tight text-foreground-muted">—</p>
      )}
      {isLow && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--error)' }}>Saldo bajo</p>
      )}
    </NexaCard>
  );
}

// ═══ Estadísticas mini ═══════════════════════════════════════════════

function StatMiniCard({
  icon,
  value,
  label,
  sublabel,
  state = 'normal',
}: {
  readonly icon: React.ReactNode;
  readonly value: string;
  readonly label: string;
  readonly sublabel: string;
  readonly state?: 'normal' | 'warning' | 'error' | 'muted';
}) {
  const color =
    state === 'error' ? 'var(--error)' :
    state === 'warning' ? 'var(--warning)' :
    state === 'muted' ? 'var(--foreground-subtle)' :
    'var(--foreground)';

  return (
    <NexaCard padding="sm" className="text-center min-w-0">
      <div className="flex justify-center mb-1.5" style={{ color: state === 'muted' ? 'var(--foreground-subtle)' : 'var(--foreground-muted)' }}>
        {icon}
      </div>
      <p
        className={`text-display text-base font-bold truncate ${state === 'error' ? 'animate-pulse' : ''}`}
        style={{ color }}
      >
        {value}
      </p>
      <p className="text-[10px] text-foreground-muted font-medium truncate">{label}</p>
      <p className="text-[9px] text-foreground-subtle truncate">{sublabel}</p>
    </NexaCard>
  );
}

// ═══ Últimas sesiones ════════════════════════════════════════════════

interface RecentSessionRowProps {
  readonly session: RecentSession;
  readonly onClick: () => void;
}

function RecentSessionRow({ session, onClick }: RecentSessionRowProps) {
  const statusConfig = {
    completed: { label: 'Completada', variant: 'success' as const, color: 'var(--success)' },
    interrupted: { label: 'Interrumpida', variant: 'warning' as const, color: 'var(--warning)' },
    error: { label: 'Error', variant: 'error' as const, color: 'var(--error)' },
  };
  const cfg = statusConfig[session.status];

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Avatar */}
      {session.avatar ? (
        <img
          src={session.avatar}
          alt={session.alias}
          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
          style={{ border: '1px solid var(--border)' }}
        />
      ) : (
        <div
          className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--primary-gradient)', color: 'var(--primary-foreground)' }}
        >
          {session.alias.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{session.alias}</p>
          <span className="text-[9px] text-foreground-subtle">·</span>
          <p className="text-[10px] text-foreground-muted">{session.dateLabel}</p>
        </div>
        <p className="text-[10px] text-foreground-muted truncate">
          <span className="font-mono">{session.timeRange}</span> · {session.durationFormatted} · <span className="font-mono">{session.consumedFormatted}</span>
        </p>
      </div>

      {/* Badge de estado */}
      <NexaBadge variant={cfg.variant} size="sm">
        {cfg.label}
      </NexaBadge>
    </div>
  );
}

// ═══ Fila de URL visitada ════════════════════════════════════════════

function VisitedUrlRow({ url }: { readonly url: VisitedUrl }) {
  // Color del dominio basado en hash (igual que avatar de cuentas)
  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];
  let hash = 0;
  for (let i = 0; i < url.domain.length; i++) hash = (hash * 31 + url.domain.charCodeAt(i)) | 0;
  const color = colors[Math.abs(hash) % colors.length]!;

  return (
    <a
      href={url.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 p-2 rounded-lg transition-colors cursor-pointer"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      title={url.url}
    >
      {/* Icon del dominio (letra inicial con color) */}
      <div
        className="flex items-center justify-center h-7 w-7 rounded-md text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {url.domain.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{url.title}</p>
        <p className="text-[9px] text-foreground-muted font-mono truncate">
          {url.domain}{url.url.length > 50 ? '...' : ''}
        </p>
      </div>

      {/* Hora de visita */}
      <span className="text-[9px] text-foreground-subtle font-mono flex-shrink-0">
        {url.visitTimeFormatted}
      </span>
    </a>
  );
}

// ═══ Modal de detalle de sesión ══════════════════════════════════════

interface SessionDetailModalProps {
  readonly session: RecentSession | null;
  readonly onClose: () => void;
}

function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  if (!session) return null;

  const statusConfig = {
    completed: { label: 'Completada', color: 'var(--success)', bgColor: 'rgba(16, 185, 129, 0.1)' },
    interrupted: { label: 'Interrumpida', color: 'var(--warning)', bgColor: 'rgba(245, 158, 11, 0.1)' },
    error: { label: 'Error', color: 'var(--error)', bgColor: 'rgba(239, 68, 68, 0.1)' },
  };
  const cfg = statusConfig[session.status];
  const startDate = new Date(session.startedAt);
  const endDate = new Date(session.endedAt);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-elevated-2)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            {session.avatar ? (
              <img src={session.avatar} alt={session.alias} className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid var(--border-strong)' }} />
            ) : (
              <div
                className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold"
                style={{ background: 'var(--primary-gradient)', color: 'var(--primary-foreground)' }}
              >
                {session.alias.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-display text-base font-semibold text-foreground">{session.alias}</h2>
              <p className="text-[10px] text-foreground-muted font-mono">
                {session.username}@{session.domain}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body con scroll */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Estado */}
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ backgroundColor: cfg.bgColor, border: `1px solid ${cfg.color}40` }}
          >
            <span className="text-sm font-medium" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
            {session.statusReason && (
              <span className="text-[10px] text-foreground-muted text-right max-w-[60%]">
                {session.statusReason}
              </span>
            )}
          </div>

          {/* Resumen: duración + consumo */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
                Duración
              </p>
              <p
                className="text-display text-lg font-bold font-mono"
                style={{
                  backgroundImage: 'var(--gradient-text-primary)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {session.durationFormatted}
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
                Consumido
              </p>
              <p className="text-display text-lg font-bold text-foreground">
                {session.consumedFormatted}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-2">
              Timeline
            </p>
            <div
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Inicio</span>
                <span className="text-xs font-mono text-foreground">
                  {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Fin</span>
                <span className="text-xs font-mono text-foreground">
                  {endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Fecha</span>
                <span className="text-xs font-mono text-foreground">
                  {startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-2">
              Saldo
            </p>
            <div
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Saldo inicial</span>
                <span className="text-xs font-mono text-foreground">${session.balanceStart.toFixed(2)} CUP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Saldo final</span>
                <span className="text-xs font-mono text-foreground">${session.balanceEnd.toFixed(2)} CUP</span>
              </div>
              <div
                className="flex items-center justify-between pt-2 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-xs font-medium text-foreground">Consumo total</span>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--error)' }}>
                  {session.consumedFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Sitios visitados */}
          {session.visitedUrls && session.visitedUrls.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">
                  Sitios visitados
                </p>
                <span className="text-[10px] text-foreground-subtle font-mono">
                  {session.visitedUrls.length} {session.visitedUrls.length === 1 ? 'sitio' : 'sitios'}
                </span>
              </div>
              <div
                className="flex flex-col gap-1 overflow-y-auto"
                style={{
                  maxHeight: '200px',
                  scrollbarWidth: 'thin',
                }}
              >
                {session.visitedUrls.map((v, idx) => (
                  <VisitedUrlRow key={idx} url={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ Modal de historial completo ═════════════════════════════════════

interface FullHistoryModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly sessions: readonly RecentSession[];
  readonly filterAccount: string;
  readonly filterTime: string;
  readonly onSessionClick: (session: RecentSession) => void;
}

function FullHistoryModal({
  open,
  onClose,
  sessions,
  filterAccount: initialAccount,
  filterTime: initialTime,
  onSessionClick,
}: FullHistoryModalProps) {
  const [historyAccount, setHistoryAccount] = useState(initialAccount);
  const [historyTime, setHistoryTime] = useState(initialTime);

  // Reset filtros al abrir
  useEffect(() => {
    if (open) {
      setHistoryAccount(initialAccount);
      setHistoryTime(initialTime);
    }
  }, [open, initialAccount, initialTime]);

  // Filtrar por tiempo
  const now = Date.now();
  const timeRanges = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  const timeRange = timeRanges[historyTime as keyof typeof timeRanges] ?? timeRanges.week;

  const filtered = sessions.filter((s) => {
    if (historyAccount !== 'all' && s.alias !== historyAccount) return false;
    if (now - s.startedAt > timeRange) return false;
    return true;
  });

  const uniqueAccounts = Array.from(new Set(sessions.map((s) => s.alias)));

  // Agrupar por día
  const grouped: Record<string, RecentSession[]> = {};
  filtered.forEach((s) => {
    const dayKey = s.dateLabel;
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push(s);
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-elevated-2)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <History size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-display text-base font-semibold text-foreground">
                Historial completo
              </h2>
              <p className="text-[10px] text-foreground-muted">
                {filtered.length} {filtered.length === 1 ? 'sesión' : 'sesiones'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filtros */}
        <div
          className="flex items-center gap-2 px-5 py-3 border-b flex-shrink-0 flex-wrap"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <NexaSelect
            value={historyAccount}
            onChange={setHistoryAccount}
            placeholder="Todas las cuentas"
            width={160}
            options={[
              { value: 'all', label: 'Todas las cuentas' },
              ...uniqueAccounts.map((acc) => ({ value: acc, label: acc })),
            ]}
          />
          <NexaSelect
            value={historyTime}
            onChange={setHistoryTime}
            width={130}
            options={[
              { value: 'week', label: 'Última semana' },
              { value: 'month', label: 'Último mes' },
              { value: 'year', label: 'Último año' },
            ]}
          />
        </div>

        {/* Lista agrupada por día con scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin' }}>
          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([dayLabel, daySessions]) => (
              <div key={dayLabel} className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-2">
                  {dayLabel} · {daySessions.length} {daySessions.length === 1 ? 'sesión' : 'sesiones'}
                </p>
                <div className="flex flex-col gap-1.5">
                  {daySessions.map((s) => (
                    <RecentSessionRow
                      key={s.id}
                      session={s}
                      onClick={() => onSessionClick(s)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <NexaEmptyState
              icon={<History size={36} className="text-foreground-subtle" />}
              title="Sin sesiones"
              description="No hay sesiones en este rango de tiempo. Prueba con otro filtro."
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ Gráfico semanal ═════════════════════════════════════════════════

interface WeeklyChartProps {
  readonly weekly: WeeklyStats;
  readonly onDayClick: (day: DayStats) => void;
}

function WeeklyChart({ weekly, onDayClick }: WeeklyChartProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const barRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {weekly.days.map((day) => {
        const heightPercent = weekly.maxMinutes > 0 ? (day.minutes / weekly.maxMinutes) * 100 : 0;

        return (
          <button
            key={day.dayIndex}
            ref={(el) => { barRefs.current[day.dayIndex] = el; }}
            type="button"
            onClick={() => onDayClick(day)}
            onMouseEnter={() => setHoveredDay(day.dayIndex)}
            onMouseLeave={() => setHoveredDay(null)}
            className="flex-1 flex flex-col items-center gap-1 min-w-0 group cursor-pointer h-full"
          >
            {/* Barra */}
            <div className="w-full flex-1 flex items-end min-h-0">
              <div
                className="w-full rounded-t transition-all duration-300 group-hover:opacity-100"
                style={{
                  height: `${Math.max(heightPercent, day.minutes > 0 ? 8 : 2)}%`,
                  minHeight: day.minutes > 0 ? '4px' : '2px',
                  backgroundImage: day.minutes > 0 ? 'var(--primary-gradient)' : 'none',
                  backgroundColor: day.minutes > 0 ? 'transparent' : 'var(--muted)',
                  opacity: day.minutes > 0 ? 0.85 : 0.4,
                  border: day.minutes > 0 ? 'none' : '1px solid var(--border)',
                }}
              />
            </div>
            {/* Label del día */}
            <span
              className="text-[9px] font-mono flex-shrink-0"
              style={{
                color: day.minutes > 0 ? 'var(--foreground-muted)' : 'var(--foreground-subtle)',
              }}
            >
              {day.dayName}
            </span>
          </button>
        );
      })}

      {/* Tooltip tematizado */}
      {weekly.days.map((day) => {
        if (hoveredDay !== day.dayIndex) return null;
        const triggerRef = { current: barRefs.current[day.dayIndex] ?? null };
        const hours = Math.floor(day.minutes / 60);
        const mins = day.minutes % 60;
        const durationText = day.minutes > 0
          ? (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
          : 'sin conexión';
        return (
          <TooltipPortal key={`tooltip-${day.dayIndex}`} show={true} triggerRef={triggerRef} position="top" offset={4}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'normal', maxWidth: '180px' }}>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>
                {day.dayNameFull} · {day.date}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>
                {durationText}
              </span>
              {day.sessionsCount > 0 && (
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  {day.sessionsCount} {day.sessionsCount === 1 ? 'sesión' : 'sesiones'}
                </span>
              )}
            </div>
          </TooltipPortal>
        );
      })}
    </div>
  );
}

// ═══ Modal de detalle del día ════════════════════════════════════════

interface DayDetailModalProps {
  readonly day: DayStats | null;
  readonly onClose: () => void;
}

function DayDetailModal({ day, onClose }: DayDetailModalProps) {
  if (!day) return null;

  const hours = Math.floor(day.minutes / 60);
  const mins = day.minutes % 60;
  const totalDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-elevated-2)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-display text-base font-semibold text-foreground">
                {day.dayNameFull}
              </h2>
              <p className="text-[10px] text-foreground-muted">{day.date}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
                Tiempo total
              </p>
              <p
                className="text-display text-lg font-bold font-mono"
                style={{
                  backgroundImage: 'var(--gradient-text-primary)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {totalDuration}
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
                Sesiones
              </p>
              <p className="text-display text-lg font-bold text-foreground">
                {day.sessionsCount}
              </p>
            </div>
          </div>

          {/* Lista de sesiones con scroll */}
          {day.sessions.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">
                  Sesiones del día
                </p>
                <span className="text-[10px] text-foreground-subtle font-mono">
                  {day.sessions.length} {day.sessions.length === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
              <div
                className="flex flex-col gap-1.5 overflow-y-auto"
                style={{
                  maxHeight: '240px',
                  scrollbarWidth: 'thin',
                  paddingRight: '4px',
                }}
              >
                {day.sessions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{ backgroundColor: 'var(--background-glass)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold flex-shrink-0"
                      style={{
                        background: 'var(--primary-gradient)',
                        color: 'var(--primary-foreground)',
                      }}
                    >
                      {s.alias.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.alias}</p>
                      <p className="text-[10px] text-foreground-muted">
                        Inicio: <span className="font-mono">{s.startTime}</span> · Duración: <span className="font-mono">{s.duration}</span>
                      </p>
                    </div>
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--error)' }}>
                      {s.consumed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-6 text-center"
            >
              <Calendar size={32} className="text-foreground-subtle mb-2" />
              <p className="text-sm text-foreground-muted">Sin sesiones este día</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
