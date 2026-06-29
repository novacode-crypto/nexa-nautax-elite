/**
 * NEXA NautaX — NexaCheckbox
 *
 * Checkbox customizado con estilo premium y tematizado.
 */

import { type InputHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface NexaCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label?: ReactNode;
  readonly hint?: string;
}

export const NexaCheckbox = ({
  label,
  hint,
  className,
  checked,
  disabled,
  ...props
}: NexaCheckboxProps) => {
  return (
    <label
      className={cn(
        'inline-flex items-start gap-2.5 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="relative inline-flex flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          className="h-4 w-4 rounded-md border transition-all duration-200 flex items-center justify-center"
          style={{
            backgroundColor: checked ? 'var(--accent)' : 'transparent',
            borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
            boxShadow: checked ? 'var(--glow-accent)' : 'none',
          }}
        >
          {checked && (
            <Check
              size={11}
              strokeWidth={3.5}
              style={{
                color: 'var(--accent-foreground)',
              }}
            />
          )}
        </span>
      </span>
      {(label || hint) && (
        <span className="flex flex-col gap-0.5">
          {label && (
            <span className="text-xs text-foreground leading-tight">{label}</span>
          )}
          {hint && (
            <span className="text-[10px] text-foreground-subtle leading-tight">{hint}</span>
          )}
        </span>
      )}
    </label>
  );
};
