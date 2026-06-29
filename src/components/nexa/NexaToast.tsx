/**
 * NEXA NautaX — NexaToast
 *  — Doc 3 §2.5
 */

import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastNotification } from '@/store/uiStore';

const toastVariants = cva(
  'pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm min-w-[280px] max-w-[360px]',
  {
    variants: {
      variant: {
        success: 'bg-card/95 border-success/30 text-foreground',
        error: 'bg-card/95 border-error/30 text-foreground',
        warning: 'bg-card/95 border-warning/30 text-foreground',
        info: 'bg-card/95 border-info/30 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const ICON_COLOR = {
  success: 'var(--success)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
} as const;

export interface NexaToastProps extends VariantProps<typeof toastVariants> {
  readonly toast: ToastNotification;
  readonly onDismiss: (id: string) => void;
  readonly children?: ReactNode;
}

export function NexaToast({ toast, onDismiss }: NexaToastProps) {
  const variant = toast.variant;
  const Icon = ICON_MAP[variant];
  const iconColor = ICON_COLOR[variant];

  return (
    <div
      className={cn(toastVariants({ variant }))}
      style={{
        animation: 'nexa-slide-in-right 200ms ease-out',
      }}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon size={18} style={{ color: iconColor }} className="flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-xs text-foreground-muted">{toast.message}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-1.5 text-xs font-medium text-primary hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-foreground-muted hover:text-foreground transition-colors"
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>
    </div>
  );
}
