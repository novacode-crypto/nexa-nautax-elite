/**
 * NEXA NautaX — StatusPill 
 *
 * + El icono pulsa (no el borde)
 */

import { useRef, useState } from 'react';
import { Wifi, WifiOff, Loader2, Clock, AlertCircle, UserX } from 'lucide-react';
import type { ConnectionStatus } from './NexaStatusIndicator';
import { TooltipPortal } from './TooltipPortal';

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; Icon: typeof Wifi; spin?: boolean; pulse?: boolean; label: string }
> = {
  connected: { color: 'var(--success)', Icon: Wifi, pulse: true, label: 'Conectado' },
  disconnected: { color: 'var(--foreground-subtle)', Icon: WifiOff, label: 'Desconectado' },
  connecting: { color: 'var(--warning)', Icon: Loader2, spin: true, label: 'Conectando' },
  offline: { color: 'var(--foreground-subtle)', Icon: WifiOff, label: 'Sin conexión' },
  expired: { color: 'var(--warning)', Icon: Clock, label: 'Sesión expirada' },
  error: { color: 'var(--error)', Icon: AlertCircle, label: 'Error' },
  'no-account': { color: 'var(--foreground-subtle)', Icon: UserX, label: 'Sin cuenta' },
};

export interface StatusPillProps {
  readonly status: ConnectionStatus;
  readonly size?: 'sm' | 'md';
}

export const StatusPill = ({ status, size = 'sm' }: StatusPillProps) => {
  const config = STATUS_CONFIG[status];
  const padding = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const iconSize = size === 'sm' ? 12 : 14;
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <>
      <span
        ref={ref}
        className={`inline-flex items-center justify-center rounded-full ${padding}`}
        style={{
          backgroundColor: 'var(--muted)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={config.label}
        role="status"
      >
        <config.Icon
          size={iconSize}
          className={config.spin ? 'animate-spin' : ''}
          style={{
            color: config.color,
            ...(config.pulse ? { animation: 'nexa-pulse 1.5s ease-in-out infinite' } : {}),
          }}
          strokeWidth={2.5}
        />
      </span>

      <TooltipPortal show={showTooltip} triggerRef={ref} position="bottom">
        {config.label}
      </TooltipPortal>
    </>
  );
};
