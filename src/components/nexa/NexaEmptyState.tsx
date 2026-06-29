/**
 * NEXA NautaX — NexaEmptyState
 * Fase 3 — Doc 3 §2.9
 */

import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface NexaEmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly className?: string;
}

export function NexaEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: NexaEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-8', className)}>
      <div className="mb-4 opacity-50">{icon}</div>
      <h3 className="text-display text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-foreground-muted max-w-xs">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
