/**
 * NEXA NautaX — NexaIcon
 * Fase 3 — Doc 3 §2.20
 *
 * Wrapper sobre lucide-react icon con tamaños estandarizados.
 */

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface NexaIconProps {
  readonly name: LucideIcon;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly className?: string;
}

const SIZE_PX: Record<NonNullable<NexaIconProps['size']>, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

export function NexaIcon({
  name: Icon,
  size = 'md',
  color,
  strokeWidth = 2,
  className,
}: NexaIconProps) {
  return (
    <Icon
      size={SIZE_PX[size]}
      color={color ?? 'currentColor'}
      strokeWidth={strokeWidth}
      className={cn(className)}
    />
  );
}
