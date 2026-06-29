/**
 * NEXA NautaX — NexaSelect
 *
 * Dropdown select tematizado con el estilo NEXA.
 * Usa DropdownPortal para evitar problemas de overflow/z-index.
 *
 * Uso:
 *   <NexaSelect
 *     value={value}
 *     onChange={setValue}
 *     options={[
 *       { value: 'all', label: 'Todas' },
 *       { value: 'pepe', label: 'Pepe' },
 *     ]}
 *     placeholder="Selecciona..."
 *   />
 */

import { useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DropdownPortal } from './DropdownPortal';

export interface NexaSelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
}

export interface NexaSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly NexaSelectOption[];
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: 'sm' | 'md';
  readonly align?: 'left' | 'right';
  readonly width?: number;
}

export function NexaSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecciona...',
  className,
  size = 'sm',
  align = 'left',
  width,
}: NexaSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const isSm = size === 'sm';
  const fixedWidth = width ?? 150;

  return (
    <div className={cn('relative', className)} style={{ width: fixedWidth }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-md transition-colors cursor-pointer w-full',
          isSm ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs',
        )}
        style={{
          width: '100%',
          backgroundColor: open ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? 'var(--accent)' : 'var(--foreground-muted)',
          boxShadow: open ? '0 0 0 2px var(--focus-ring)' : 'none',
        }}
        aria-expanded={open}
      >
        {selected?.icon}
        <span className="flex-1 text-left truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={isSm ? 10 : 12}
          className={cn('transition-transform flex-shrink-0', open && 'rotate-180')}
        />
      </button>

      <DropdownPortal
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        align={align}
        width={fixedWidth}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left cursor-pointer"
              style={{
                backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {opt.icon}
              <span
                className={cn('flex-1 truncate', isSm ? 'text-[10px]' : 'text-xs')}
                style={{ color: isActive ? 'var(--accent)' : 'var(--foreground)' }}
              >
                {opt.label}
              </span>
              {isActive && <Check size={12} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />}
            </button>
          );
        })}
      </DropdownPortal>
    </div>
  );
}
