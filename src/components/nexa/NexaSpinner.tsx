/**
 * NEXA NautaX — NexaSpinner
 * Fase 3 — Doc 3 §2.7
 */

import { cn } from '@/utils/cn';

export interface NexaSpinnerProps {
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const SIZE_PX: Record<NonNullable<NexaSpinnerProps['size']>, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
};

export function NexaSpinner({ size = 'md', className }: NexaSpinnerProps) {
  const px = SIZE_PX[size];
  return (
    <svg
      className={cn('animate-spin', className)}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
