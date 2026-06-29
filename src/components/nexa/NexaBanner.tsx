/**
 * NEXA NautaX — NexaBanner
 *  — Doc 3 §2.8
 */

import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';

const bannerVariants = cva(
  'flex items-start gap-3 rounded-md border p-3 text-sm',
  {
    variants: {
      variant: {
        info: 'bg-info/10 border-info/30 text-foreground',
        warning: 'bg-warning/10 border-warning/30 text-foreground',
        error: 'bg-error/10 border-error/30 text-foreground',
        success: 'bg-success/10 border-success/30 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

const ICON_COLOR = {
  info: 'var(--info)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  success: 'var(--success)',
} as const;

export interface NexaBannerProps extends VariantProps<typeof bannerVariants> {
  readonly title: string;
  readonly message?: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly dismissible?: boolean;
  readonly onDismiss?: () => void;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function NexaBanner({
  variant = 'info',
  title,
  message,
  action,
  dismissible = false,
  onDismiss,
  className,
  children,
}: NexaBannerProps) {
  const Icon = ICON_MAP[variant ?? 'info'];
  const iconColor = ICON_COLOR[variant ?? 'info'];

  return (
    <div className={cn(bannerVariants({ variant }), className)} role="status">
      <Icon size={18} style={{ color: iconColor }} className="flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        {message && <p className="mt-0.5 text-foreground-muted">{message}</p>}
        {children}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
