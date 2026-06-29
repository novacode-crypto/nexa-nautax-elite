/**
 * NEXA NautaX — NexaCard 
 *  — Doc 3 §2.3
 *
 * Con glassmorphism, shadow coloreada y border gradient.
 */

import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const cardVariants = cva(
  'relative rounded-xl transition-all duration-300 ease-out',
  {
    variants: {
      variant: {
        default: 'backdrop-blur-xl border text-card-foreground',
        elevated: 'backdrop-blur-2xl border text-card-foreground',
        interactive:
          'backdrop-blur-xl border text-card-foreground cursor-pointer hover:-translate-y-0.5',
        solid: 'border text-card-foreground',
        outline: 'border border-border-strong bg-transparent',
        gradient: 'backdrop-blur-xl text-card-foreground',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  },
);

export interface NexaCardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly glow?: boolean;
}

export const NexaCard = forwardRef<HTMLDivElement, NexaCardProps>(function NexaCard(
  { variant, padding, header, footer, glow = false, className, children, ...props },
  ref,
) {
  const cardStyle: CSSProperties = (() => {
    if (variant === 'outline') return {};
    if (variant === 'solid') {
      return {
        backgroundColor: 'var(--card-solid)',
        borderColor: 'var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      };
    }
    if (variant === 'gradient') {
      return {
        background: 'var(--background-glass)',
        border: '1px solid transparent',
        backgroundImage:
          'linear-gradient(var(--background-elevated), var(--background-elevated)), var(--border-gradient)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: glow ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
      };
    }
    // default, elevated, interactive
    return {
      backgroundColor: 'var(--card)',
      borderColor: 'var(--card-border)',
      boxShadow: glow ? 'var(--card-shadow-hover), var(--glow-primary)' : 'var(--card-shadow)',
    };
  })();

  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      style={cardStyle}
      {...props}
    >
      {header && <div className="mb-3 pb-3 border-b border-border-subtle">{header}</div>}
      {children}
      {footer && <div className="mt-3 pt-3 border-t border-border-subtle">{footer}</div>}
    </div>
  );
});
