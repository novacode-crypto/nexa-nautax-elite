/**
 * NEXA NautaX — NexaSwitch
 *
 * Switch / toggle premium con animación suave, glow al activarse,
 * soporte para label y descripción.
 */

import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface NexaSwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: ReactNode;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

export const NexaSwitch = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
}: NexaSwitchProps) => {
  // Tamaños: sm = 36x20, md = 44x24
  const trackW = size === 'sm' ? 36 : 44;
  const trackH = size === 'sm' ? 20 : 24;
  const thumb = size === 'sm' ? 14 : 18;
  const translate = size === 'sm' ? 16 : 22;

  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-all duration-200 flex-shrink-0',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      style={{
        width: trackW,
        height: trackH,
        backgroundImage: checked ? 'var(--primary-gradient)' : 'none',
        backgroundColor: checked ? 'transparent' : 'var(--muted)',
        border: `1px solid ${checked ? 'transparent' : 'var(--border-strong)'}`,
        boxShadow: checked ? 'var(--glow-primary)' : 'inset 0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all duration-200"
        style={{
          width: thumb,
          height: thumb,
          left: 2,
          top: '50%',
          transform: checked
            ? `translateX(${translate}px) translateY(-50%)`
            : 'translateX(0) translateY(-50%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.05)',
        }}
      />
    </button>
  );

  if (!label && !description) {
    return switchEl;
  }

  return (
    <div className={cn('flex items-center justify-between gap-3 py-2', className)}>
      <div className="flex-1 min-w-0">
        {label && (
          <p className={cn('text-sm text-foreground', size === 'sm' && 'text-xs')}>{label}</p>
        )}
        {description && (
          <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
        )}
      </div>
      {switchEl}
    </div>
  );
};
