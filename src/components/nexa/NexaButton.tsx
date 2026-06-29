/**
 * NEXA NautaX — NexaButton — Premium edition
 * Fase 3 — Doc 3 §2.2
 *
 * Primary con gradient + glow, micro-interacciones mejoradas.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { NexaSpinner } from './NexaSpinner';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-out focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden',
  {
    variants: {
      variant: {
        primary:
          'text-primary-foreground active:scale-[0.97] shadow-lg',
        secondary:
          'text-secondary-foreground border hover:bg-muted active:scale-[0.97]',
        ghost: 'text-foreground hover:bg-muted active:scale-[0.97]',
        danger:
          'text-destructive-foreground active:scale-[0.97] shadow-lg',
        outline:
          'border border-border-strong text-foreground hover:bg-muted active:scale-[0.97]',
      },
      size: {
        xs: 'h-7 px-3 text-xs',
        sm: 'h-8 px-3.5 text-sm',
        md: 'h-10 px-5 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface NexaButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly iconRight?: ReactNode;
  readonly fullWidth?: boolean;
  readonly glow?: boolean;
}

export const NexaButton = forwardRef<HTMLButtonElement, NexaButtonProps>(function NexaButton(
  {
    variant,
    size,
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    glow = false,
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  // Estilos inline para gradient + glow en primary/danger
  const variantStyle: React.CSSProperties = {};

  if (variant === 'primary') {
    variantStyle.backgroundImage = 'var(--primary-gradient)';
    variantStyle.borderColor = 'transparent';
    variantStyle.boxShadow = glow
      ? 'var(--glow-primary), 0 4px 12px rgba(0, 0, 0, 0.2)'
      : '0 4px 12px rgba(0, 0, 0, 0.15)';
  } else if (variant === 'danger') {
    variantStyle.background = 'var(--destructive)';
    variantStyle.borderColor = 'transparent';
    variantStyle.boxShadow = glow
      ? 'var(--glow-error), 0 4px 12px rgba(0, 0, 0, 0.2)'
      : '0 4px 12px rgba(0, 0, 0, 0.15)';
  } else if (variant === 'secondary') {
    variantStyle.backgroundColor = 'var(--secondary)';
    variantStyle.borderColor = 'var(--border)';
  }

  return (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ variant, size }),
        fullWidth && 'w-full',
        // Shine effect on primary
        variant === 'primary' && 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700',
        className,
      )}
      disabled={disabled || loading}
      style={variantStyle}
      {...props}
    >
      {loading ? (
        <NexaSpinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        <>
          {icon && <span className="relative z-10 flex-shrink-0">{icon}</span>}
          {children && <span className="relative z-10">{children}</span>}
          {iconRight && <span className="relative z-10 flex-shrink-0">{iconRight}</span>}
        </>
      )}
    </button>
  );
});
