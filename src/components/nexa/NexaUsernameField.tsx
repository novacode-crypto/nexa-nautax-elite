/**
 * NEXA NautaX — NexaUsernameField — Debug v6
 *
 * Mejoras v6:
 * - Tooltip via portal (no se corta nunca)
 * - Glow effect al hover del campo completo
 * - Trigger del dominio con ancho fijo (160px)
 * - Dropdown del dominio del mismo ancho
 */

import { type ChangeEvent, useRef, useState, useEffect } from 'react';
import { ChevronDown, Globe, MapPin, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DropdownPortal } from './DropdownPortal';
import { TooltipPortal } from './TooltipPortal';

export type NautaDomain = 'nauta.com.cu' | 'nauta.co.cu';

export interface NexaUsernameFieldProps {
  readonly value: string;
  readonly onChange: (username: string, domain: NautaDomain) => void;
  readonly domain?: NautaDomain;
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly id?: string;
}

const DOMAINS: ReadonlyArray<{
  readonly value: NautaDomain;
  readonly label: string;
  readonly description: string;
  readonly Icon: typeof Globe;
}> = [
  {
    value: 'nauta.com.cu',
    label: '@nauta.com.cu',
    description: 'Navegación Internacional',
    Icon: Globe,
  },
  {
    value: 'nauta.co.cu',
    label: '@nauta.co.cu',
    description: 'Navegación Nacional',
    Icon: MapPin,
  },
];

const DOMAIN_TRIGGER_WIDTH = 160;

export const NexaUsernameField = ({
  value,
  onChange,
  domain: domainProp = 'nauta.com.cu',
  label = 'Usuario',
  placeholder = 'pepe.perez',
  error,
  id,
}: NexaUsernameFieldProps) => {
  const [domain, setDomain] = useState<NautaDomain>(domainProp);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showDomainTooltip, setShowDomainTooltip] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sincronizar dominio cuando cambia externamente (ej: al seleccionar otra cuenta)
  useEffect(() => {
    setDomain(domainProp);
  }, [domainProp]);

  const selected = DOMAINS.find((d) => d.value === domain) ?? DOMAINS[0]!;
  const isActive = hovered || focused || open;

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, domain);
  };

  const handleDomainChange = (newDomain: NautaDomain) => {
    setDomain(newDomain);
    onChange(value, newDomain);
    setOpen(false);
  };

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-[10px] uppercase tracking-widest font-medium text-foreground-muted mb-1.5"
        >
          {label}
        </label>
      )}

      <div
        className="relative flex h-11 rounded-lg transition-all"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: `1px solid ${error ? 'var(--error)' : open ? 'var(--accent)' : isActive ? 'var(--border-strong)' : 'var(--border)'}`,
          boxShadow: error
            ? '0 0 0 3px var(--glow-error)'
            : open
              ? '0 0 0 3px var(--focus-ring), var(--glow-accent)'
              : isActive
                ? 'var(--glow-accent)'
                : '0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Input del nombre */}
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleUsernameChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 min-w-0 px-3 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none rounded-l-lg"
        />

        {/* Divider */}
        <div
          className="w-px self-stretch my-2 flex-shrink-0"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* Trigger del dominio — ancho FIJO */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setShowDomainTooltip(true)}
          onMouseLeave={() => setShowDomainTooltip(false)}
          className="flex items-center gap-1.5 h-full px-3 transition-colors flex-shrink-0 rounded-r-lg cursor-pointer justify-center"
          style={{
            width: `${DOMAIN_TRIGGER_WIDTH}px`,
            color: open ? 'var(--accent)' : 'var(--foreground-muted)',
            backgroundColor: open ? 'var(--accent-soft)' : 'transparent',
          }}
          aria-label={`Tipo de cuenta: ${selected.description}. Click para cambiar`}
          aria-expanded={open}
        >
          <selected.Icon size={12} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
          <span className="whitespace-nowrap font-mono text-[11px] flex-1 text-center">
            {selected.label}
          </span>
          <ChevronDown
            size={12}
            className={cn('transition-transform flex-shrink-0', open && 'rotate-180')}
          />
        </button>

        {/* Tooltip via portal — no se corta */}
        <TooltipPortal
          show={showDomainTooltip && !open}
          triggerRef={triggerRef}
          position="bottom"
        >
          {selected.description}
        </TooltipPortal>
      </div>

      {/* Dropdown via portal — ancho del trigger */}
      <DropdownPortal
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        align="right"
        width={DOMAIN_TRIGGER_WIDTH}
      >
        <div
          className="px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-medium text-foreground-muted">
            Tipo de cuenta
          </p>
        </div>
        {DOMAINS.map((d) => {
          const isActive = d.value === domain;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => handleDomainChange(d.value)}
              className="w-full flex items-center gap-2 px-3 py-3 transition-colors text-left cursor-pointer"
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
              <div
                className="flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0"
                style={{
                  backgroundColor: isActive ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                <d.Icon
                  size={12}
                  style={{
                    color: isActive ? 'var(--accent-foreground)' : 'var(--foreground-muted)',
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-mono font-medium truncate"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--foreground)' }}
                >
                  {d.label}
                </p>
                <p className="text-[9px] text-foreground-muted truncate mt-0.5">
                  {d.description}
                </p>
              </div>
              {isActive && (
                <Check size={12} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
              )}
            </button>
          );
        })}
      </DropdownPortal>

      {error && <p className="mt-1.5 text-xs text-error">⚠ {error}</p>}
    </div>
  );
};
