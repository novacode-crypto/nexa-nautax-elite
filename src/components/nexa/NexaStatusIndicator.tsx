/**
 * NEXA NautaX — NexaStatusIndicator 
 *  — Doc 3 §2.4
 *
 * Dots con glow, iconos con color, animación más sutil.
 */

import { cn } from '@/utils/cn';
import { Wifi, WifiOff, Loader2, Clock, AlertCircle, UserX } from 'lucide-react';

export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'offline'
  | 'expired'
  | 'error'
  | 'no-account';

export interface NexaStatusIndicatorProps {
  readonly status: ConnectionStatus;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly showIcon?: boolean;
  readonly showLabel?: boolean;
  readonly className?: string;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  {
    label: string;
    color: string;
    glow: string;
    pulse: boolean;
    Icon: typeof Wifi;
  }
> = {
  connected: {
    label: 'Conectado',
    color: 'var(--success)',
    glow: 'var(--glow-success)',
    pulse: false,
    Icon: Wifi,
  },
  disconnected: {
    label: 'Desconectado',
    color: 'var(--foreground-subtle)',
    glow: 'none',
    pulse: false,
    Icon: WifiOff,
  },
  connecting: {
    label: 'Conectando...',
    color: 'var(--warning)',
    glow: 'var(--glow-warning)',
    pulse: true,
    Icon: Loader2,
  },
  offline: {
    label: 'Sin conexión',
    color: 'var(--foreground-subtle)',
    glow: 'none',
    pulse: false,
    Icon: WifiOff,
  },
  expired: {
    label: 'Sesión expirada',
    color: 'var(--warning)',
    glow: 'var(--glow-warning)',
    pulse: false,
    Icon: Clock,
  },
  error: {
    label: 'Error',
    color: 'var(--error)',
    glow: 'var(--glow-error)',
    pulse: false,
    Icon: AlertCircle,
  },
  'no-account': {
    label: 'Sin cuenta',
    color: 'var(--foreground-subtle)',
    glow: 'none',
    pulse: false,
    Icon: UserX,
  },
};

const SIZE_CONFIG: Record<
  NonNullable<NexaStatusIndicatorProps['size']>,
  { dot: string; ring: string; icon: number; text: string }
> = {
  sm: { dot: 'h-1.5 w-1.5', ring: 'h-3 w-3', icon: 12, text: 'text-xs' },
  md: { dot: 'h-2 w-2', ring: 'h-3.5 w-3.5', icon: 14, text: 'text-sm' },
  lg: { dot: 'h-2.5 w-2.5', ring: 'h-5 w-5', icon: 18, text: 'text-base' },
};

export function NexaStatusIndicator({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className,
}: NexaStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Status dot con halo glow */}
      <span className={cn('relative inline-flex items-center justify-center', sizeConfig.ring)}>
        {config.pulse && (
          <span
            className={cn('absolute inline-flex rounded-full', sizeConfig.ring)}
            style={{
              backgroundColor: config.color,
              opacity: 0.3,
              animation: 'nexa-pulse 1.8s ease-in-out infinite',
            }}
          />
        )}
        <span
          className={cn('relative inline-flex rounded-full', sizeConfig.dot)}
          style={{
            backgroundColor: config.color,
            boxShadow: config.glow !== 'none' ? config.glow : 'none',
          }}
        />
      </span>

      {showIcon && (
        <config.Icon
          size={sizeConfig.icon}
          className={config.pulse ? 'animate-spin' : ''}
          style={{ color: config.color }}
          strokeWidth={2.5}
        />
      )}

      {showLabel && (
        <span
          className={cn('font-medium tracking-tight', sizeConfig.text)}
          style={{ color: status === 'disconnected' || status === 'offline' || status === 'no-account' ? 'var(--foreground-muted)' : 'var(--foreground)' }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}
