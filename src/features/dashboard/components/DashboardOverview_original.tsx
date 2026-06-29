/**
 * NEXA NautaX — Dashboard Overview (SidePanel) — Sección 1
 *
 * Hero + Status card
 *
 *  - Status card: estado del portal ETECSA (ONLINE / CAPTIVE_PORTAL / OFFLINE / UNKNOWN)
 *      Informativo, sin botones de acción.
 *      Auto-refresh cada 30s + botón manual.
 *  - Hero:
 *      - Sin sesión: empty state informativo (sin botones, las acciones van en el popup)
 *      - Con sesión: card con avatar + alias + username + badge "Conectado" + cronómetro en vivo
 */

import { Wifi, WifiOff, Globe, RefreshCw, Clock, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { NexaEmptyState } from '@/components/nexa/NexaEmptyState';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { useDashboardData, type PortalStatus } from '@/features/dashboard/hooks/useDashboardData';
import { useSessionTimer } from '@/hooks/useSessionTimer';

export function DashboardOverview() {
  const { session, portalStatus, loadingSession, loadingPortal, refreshPortal, portalError } = useDashboardData();
  const timer = useSessionTimer(session?.startedAt ?? null);

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

      {/* —— Status card: estado del portal ETECSA —— */}
      <StaggerItem index={1}>
        <PortalStatusCard
          status={portalStatus}
          loading={loadingPortal}
          error={portalError}
          onRefresh={refreshPortal}
        />
      </StaggerItem>

      {/* —— Hero: sesión activa o empty state —— */}
      <StaggerItem index={2}>
        {loadingSession ? (
          <NexaCard padding="lg">
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
            </div>
          </NexaCard>
        ) : session ? (
          <ActiveSessionHero session={session} elapsedFormatted={timer.elapsedFormatted} elapsedCompact={timer.elapsedCompact} />
        ) : (
          <NoSessionHero portalStatus={portalStatus} />
        )}
      </StaggerItem>
    </div>
  );
}

// ═══ Status card: estado del portal ETECSA ═══════════════════════════

interface PortalStatusCardProps {
  readonly status: PortalStatus;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
}

function PortalStatusCard({ status, loading, error, onRefresh }: PortalStatusCardProps) {
  const config = getPortalStatusConfig(status);

  return (
    <NexaCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-display text-sm font-semibold text-foreground">Portal ETECSA</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded-md transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
          aria-label="Actualizar estado del portal"
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--foreground-muted)';
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0"
          style={{
            backgroundColor: `${config.color}15`,
            border: `1px solid ${config.color}40`,
          }}
        >
          <config.Icon size={20} style={{ color: config.color }} className={config.spin ? 'animate-pulse' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="text-xs text-foreground-muted">{config.description}</p>
          {error && (
            <p className="text-[10px] text-error mt-0.5">{error}</p>
          )}
        </div>
        <NexaBadge variant={config.badgeVariant} size="sm">
          {config.short}
        </NexaBadge>
      </div>
    </NexaCard>
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

// ═══ Hero: sesión activa ═════════════════════════════════════════════

interface ActiveSessionHeroProps {
  readonly session: {
    readonly alias: string;
    readonly username: string;
    readonly domain: string;
    readonly avatar?: string | undefined;
    readonly startedAt: number;
  };
  readonly elapsedFormatted: string;
  readonly elapsedCompact: string;
}

function ActiveSessionHero({ session, elapsedFormatted, elapsedCompact }: ActiveSessionHeroProps) {
  return (
    <NexaCard padding="lg" glow variant="gradient">
      {/* Header: badge Conectado */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: 'var(--success)' }}
          >
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ backgroundColor: 'var(--success)' }}
            />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--success)' }}>
            Conectado
          </span>
        </div>
        <NexaBadge variant="success" size="sm" icon={<ShieldCheck size={10} />}>
          Sesión activa
        </NexaBadge>
      </div>

      {/* Cuenta */}
      <div className="flex items-center gap-3 mb-4">
        {session.avatar ? (
          <img
            src={session.avatar}
            alt={session.alias}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
            style={{ border: '2px solid var(--border-strong)' }}
          />
        ) : (
          <div
            className="flex items-center justify-center h-12 w-12 rounded-full text-lg font-bold flex-shrink-0"
            style={{
              background: 'var(--primary-gradient)',
              color: 'var(--primary-foreground)',
              boxShadow: 'var(--glow-primary)',
            }}
          >
            {session.alias.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{session.alias}</p>
          <p className="text-xs text-foreground-muted font-mono truncate">
            {session.username}@{session.domain}
          </p>
        </div>
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
    </NexaCard>
  );
}

// ═══ Hero: sin sesión ════════════════════════════════════════════════

function NoSessionHero({ portalStatus }: { readonly portalStatus: PortalStatus }) {
  const canConnect = portalStatus === 'CAPTIVE_PORTAL';

  return (
    <NexaCard padding="lg" variant="gradient">
      <NexaEmptyState
        icon={<WifiOff size={48} className="text-foreground-subtle" />}
        title={canConnect ? 'Listo para conectar' : 'Sin sesión activa'}
        description={
          canConnect
            ? 'Estás en el portal cautivo de ETECSA. Abre el popup de la extensión para conectar tu cuenta.'
            : 'Abre el popup de la extensión para conectar una cuenta Nauta.'
        }
      />
      {/* Info contextual sin botones de acción */}
      <div
        className="mt-4 flex items-start gap-2 p-3 rounded-lg text-xs"
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
    </NexaCard>
  );
}
