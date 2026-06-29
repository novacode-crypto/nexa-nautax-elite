/**
 * NEXA NautaX — NexaAccountSelector — Debug v6
 *
 * Mejoras v6:
 * - Dropdown ancho completo (del padre) + más grande
 * - Trigger más grande (h-12 en vez de h-11)
 * - Avatar más grande (h-9 w-9)
 * - Padding más generoso
 */

import { useRef, useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DropdownPortal } from './DropdownPortal';

export interface AccountOption {
  readonly id: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: 'nauta.com.cu' | 'nauta.co.cu';
  readonly type: 'prepaid';
  readonly avatar?: string | undefined;
}

export interface NexaAccountSelectorProps {
  readonly accounts: readonly AccountOption[];
  readonly selectedId?: string | null;
  readonly onSelect: (account: AccountOption) => void;
  readonly onAddAccount?: () => void;
  readonly label?: string;
}

function colorForAlias(alias: string): string {
  const colors = [
    'var(--accent)',
    'var(--success)',
    'var(--warning)',
    'var(--info)',
    'var(--primary)',
  ];
  let hash = 0;
  for (let i = 0; i < alias.length; i++) {
    hash = (hash * 31 + alias.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length]!;
}

function getInitial(alias: string): string {
  return alias.trim().charAt(0).toUpperCase() || '?';
}

export const NexaAccountSelector = ({
  accounts,
  selectedId,
  onSelect,
  onAddAccount,
  label,
}: NexaAccountSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const isActive = hovered || open;

  if (accounts.length === 0) {
    return (
      <button
        type="button"
        onClick={onAddAccount}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-lg border border-dashed text-sm font-medium transition-all cursor-pointer"
        style={{
          borderColor: 'var(--border-strong)',
          color: 'var(--foreground-muted)',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
          e.currentTarget.style.boxShadow = 'var(--glow-accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)';
          e.currentTarget.style.color = 'var(--foreground-muted)';
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Plus size={16} />
        Agregar cuenta
      </button>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <p className="block text-[10px] uppercase tracking-widest font-medium text-foreground-muted mb-1.5">
          {label}
        </p>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="w-full flex items-center gap-3 h-14 px-4 rounded-lg transition-all cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: `1px solid ${open ? 'var(--accent)' : isActive ? 'var(--border-strong)' : 'var(--border)'}`,
            boxShadow: open
              ? '0 0 0 3px var(--focus-ring), var(--glow-accent)'
              : isActive
                ? 'var(--glow-accent)'
                : '0 1px 2px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Avatar — imagen personalizada o inicial */}
          {selected?.avatar ? (
            <img src={selected.avatar} alt={selected.alias} className="h-10 w-10 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid var(--border)' }} />
          ) : (
            <span
              className="flex items-center justify-center h-10 w-10 rounded-full text-base font-bold flex-shrink-0"
              style={{
                backgroundColor: colorForAlias(selected?.alias ?? 'N'),
                color: 'var(--accent-foreground)',
              }}
            >
              {getInitial(selected?.alias ?? '?')}
            </span>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-foreground truncate">
              {selected?.alias ?? 'Selecciona una cuenta'}
            </p>
            {selected && (
              <p className="text-[10px] text-foreground-muted font-mono truncate">
                {selected.username}@{selected.domain}
              </p>
            )}
          </div>

          <ChevronDown
            size={18}
            className={cn('text-foreground-muted transition-transform flex-shrink-0', open && 'rotate-180')}
          />
        </button>

        {/* Dropdown via portal — ancho completo del trigger */}
        <DropdownPortal
          open={open}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
          align="left"
          width="auto"
        >
          {accounts.map((account) => {
            const isActive = account.id === selectedId;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  onSelect(account);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left cursor-pointer"
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
                {account.avatar ? (
                  <img src={account.avatar} alt={account.alias} className="h-8 w-8 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
                ) : (
                  <span
                    className="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: colorForAlias(account.alias),
                      color: 'var(--accent-foreground)',
                    }}
                  >
                    {getInitial(account.alias)}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--foreground)' }}
                  >
                    {account.alias}
                  </p>
                  <p className="text-[10px] text-foreground-muted font-mono truncate mt-0.5">
                    {account.username}@{account.domain}
                  </p>
                </div>
                {isActive && (
                  <Check size={14} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
                )}
              </button>
            );
          })}

          {onAddAccount && (
            <button
              type="button"
              onClick={() => {
                onAddAccount();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-t cursor-pointer"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--foreground-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--muted)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--foreground-muted)';
              }}
            >
              <span
                className="flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: 'var(--muted)',
                  border: '1px dashed var(--border-strong)',
                }}
              >
                <Plus size={12} />
              </span>
              <span className="text-sm font-medium">Agregar nueva cuenta</span>
            </button>
          )}
        </DropdownPortal>
      </div>
    </div>
  );
};
