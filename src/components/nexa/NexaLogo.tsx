/**
 * NEXA NautaX — NexaLogo 
 *  — Doc 3 §2.1
 *
 * "NEXA" con gradient text, "NautaX" sutil.
 * Icono con gradient + glow opcional.
 * Opción `elite` para mostrar badge "Elite" junto al wordmark.
 */

import { cn } from '@/utils/cn';

export interface NexaLogoProps {
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
  readonly variant?: 'full' | 'icon' | 'wordmark';
  readonly glow?: boolean;
  readonly elite?: boolean;
  readonly className?: string;
}

const SIZE_CONFIG: Record<
  NonNullable<NexaLogoProps['size']>,
  { text: string; icon: string; gap: string }
> = {
  sm: { text: 'text-base', icon: 'h-6 w-6', gap: 'gap-2' },
  md: { text: 'text-xl', icon: 'h-8 w-8', gap: 'gap-2.5' },
  lg: { text: 'text-2xl', icon: 'h-10 w-10', gap: 'gap-3' },
  xl: { text: 'text-4xl', icon: 'h-14 w-14', gap: 'gap-4' },
};

export function NexaLogo({ size = 'md', variant = 'full', glow = false, elite = false, className }: NexaLogoProps) {
  const config = SIZE_CONFIG[size];

  if (variant === 'icon') {
    // El className del consumidor puede sobrescribir el tamaño base (ej. !h-20 !w-20)
    return <LogoIcon className={cn(config.icon, className)} glow={glow} />;
  }

  if (variant === 'wordmark') {
    return (
      <div className={cn('flex items-center', config.gap, className)}>
        <Wordmark size={size} />
        {elite && <EliteBadge size={size} />}
      </div>
    );
  }

  // full
  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <LogoIcon className={config.icon} glow={glow} />
      <div className={cn('flex items-center', 'gap-1.5')}>
        <Wordmark size={size} />
        {elite && <EliteBadge size={size} />}
      </div>
    </div>
  );
}

// —— Wordmark (NEXA + NautaX) ———————————————————————————————————

function Wordmark({ size }: { readonly size: NonNullable<NexaLogoProps['size']> }) {
  const text = SIZE_CONFIG[size].text;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn('text-display font-bold tracking-tight', text)}
        style={{
          backgroundImage: 'var(--gradient-text-primary)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        NEXA
      </span>
      <span
        className={cn('text-display font-medium tracking-tight', text)}
        style={{ color: 'var(--foreground-muted)' }}
      >
        NautaX
      </span>
    </span>
  );
}

// —— Elite badge ————————————————————————————————————————————————

function EliteBadge({ size }: { readonly size: NonNullable<NexaLogoProps['size']> }) {
  const isSmall = size === 'sm';
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold uppercase tracking-wider rounded-md leading-none select-none',
        isSmall ? 'text-[9px] px-1.5 py-0.5 ml-1' : 'text-[10px] px-2 py-1 ml-1.5',
      )}
      style={{
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
      }}
      title="Edición ELITE"
    >
      ELITE
    </span>
  );
}

// —— Icono NEXA (cuadrado con N estilizada + gradient) ————————————

function LogoIcon({ className, glow = false }: { readonly className?: string; readonly glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 8px var(--primary-glow))' } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nexa-grad-icon" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="0.5" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--primary-active)" />
        </linearGradient>
        <linearGradient id="nexa-grad-shine" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.3)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Rounded square con gradient */}
      <rect width="32" height="32" rx="9" fill="url(#nexa-grad-icon)" />
      {/* Shine superior */}
      <rect width="32" height="16" rx="9" fill="url(#nexa-grad-shine)" />
      {/* N estilizada */}
      <path
        d="M9 23V9h2.5l9 9.5V9H23v14h-2.5l-9-9.5V23H9z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  );
}
