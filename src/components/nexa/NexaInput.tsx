/**
 * NEXA NautaX — NexaInput — Debug v6
 *
 * Glow effect al hover y focus.
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';

export interface NexaInputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly icon?: ReactNode;
  readonly rightSlot?: ReactNode;
}

export const NexaInput = forwardRef<HTMLInputElement, NexaInputProps>(function NexaInput(
  { label, hint, error, icon, rightSlot, className, id, ...props },
  ref,
) {
  const inputId = id || props.name;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isActive = hovered || focused;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] uppercase tracking-widest font-medium text-foreground-muted mb-1.5"
        >
          {label}
        </label>
      )}

      <div
        className="relative group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none transition-colors group-focus-within:text-accent">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          onFocus={(e) => {
            setFocused(true);
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring), var(--glow-accent)';
            }
          }}
          onBlur={(e) => {
            setFocused(false);
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
            }
          }}
          className={cn(
            'h-11 w-full rounded-lg px-3 text-sm text-foreground placeholder:text-foreground-subtle transition-all duration-200',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon && 'pl-10',
            rightSlot && 'pr-10',
            className,
          )}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
            boxShadow: error
              ? '0 0 0 3px var(--glow-error)'
              : isActive
                ? 'var(--glow-accent)'
                : '0 1px 2px rgba(0, 0, 0, 0.1)',
          }}
          {...props}
        />

        {rightSlot && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted">
            {rightSlot}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-error flex items-center gap-1">⚠ {error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
});
