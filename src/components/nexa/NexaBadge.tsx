/**
 * NEXA NautaX — NexaBadge
 *  — Doc 3 §2.13
 */

import { type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary text-primary-foreground',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        error: 'bg-error text-white',
        outline: 'border border-border-strong text-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-xs',
        md: 'px-2 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

export interface NexaBadgeProps extends VariantProps<typeof badgeVariants> {
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  readonly className?: string;
}

export function NexaBadge({ variant, size, icon, children, className }: NexaBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {icon}
      {children}
    </span>
  );
}
