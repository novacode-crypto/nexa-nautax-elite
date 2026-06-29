/**
 * NEXA NautaX — Accounts View (SidePanel) 
 *
 * CRUD completo de cuentas:
 *  - Lista de cuentas reales desde accountStore
 *  - Crear cuenta (AccountFormDialog)
 *  - Editar cuenta (AccountFormDialog en modo edit)
 *  - Eliminar cuenta (AccountDeleteDialog)
 *  - Seleccionar cuenta activa
 *  - Avatar con inicial del alias
 */

import { useState, useEffect, useRef } from 'react';
import { UserPlus, Users, MoreVertical, Pencil, Trash2, Check } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { NexaEmptyState } from '@/components/nexa/NexaEmptyState';
import { NexaCard } from '@/components/nexa/NexaCard';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { DropdownPortal } from '@/components/nexa/DropdownPortal';
import { AccountFormDialog } from './AccountFormDialog';
import { AccountDeleteDialog } from './AccountDeleteDialog';
import { useAccountStore } from '@/store/accountStore';
import { useToast } from '@/providers/ToastProvider';
import type { AccountSummary } from '@/modules/messaging/messageClient';

// Color hash para avatar
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

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Nunca';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

export function AccountsView() {
  const accounts = useAccountStore((s) => s.accounts);
  const selectedId = useAccountStore((s) => s.selectedId);
  const select = useAccountStore((s) => s.select);
  const hydrate = useAccountStore((s) => s.hydrate);
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountSummary | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<AccountSummary | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpenId]);

  const handleEdit = (account: AccountSummary) => {
    setEditAccount(account);
    setShowForm(true);
    setMenuOpenId(null);
  };

  const handleDelete = (account: AccountSummary) => {
    setDeleteAccount(account);
    setMenuOpenId(null);
  };

  const handleSelect = async (account: AccountSummary) => {
    await select(account.id);
    toast.info(`Cuenta seleccionada: ${account.alias}`);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditAccount(null);
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Header */}
      <StaggerItem index={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display text-2xl font-bold tracking-tight mb-1">Cuentas</h1>
            <p className="text-sm text-foreground-muted">Gestiona tus cuentas Nauta.</p>
          </div>
          <NexaButton
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            onClick={() => {
              setEditAccount(null);
              setShowForm(true);
            }}
          >
            Agregar
          </NexaButton>
        </div>
      </StaggerItem>

      {/* Empty state */}
      {accounts.length === 0 && (
        <StaggerItem index={1}>
          <NexaCard padding="lg">
            <NexaEmptyState
              icon={<Users size={48} className="text-foreground-subtle" />}
              title="No hay cuentas todavía"
              description="Agrega tu primera cuenta Nauta para comenzar a usar NEXA NautaX ELITE."
              action={{
                label: '+ Agregar cuenta',
                onClick: () => {
                  setEditAccount(null);
                  setShowForm(true);
                },
              }}
            />
          </NexaCard>
        </StaggerItem>
      )}

      {/* Account list */}
      {accounts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {accounts.map((account, i) => {
            const isSelected = account.id === selectedId;
            return (
              <StaggerItem key={account.id} index={i + 1}>
                <NexaCard
                  padding="md"
                  variant="default"
                  className="w-full"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {account.avatar ? (
                        <img src={account.avatar} alt={account.alias} className="h-10 w-10 rounded-full object-cover" style={{ border: '2px solid var(--border)' }} />
                      ) : (
                        <span
                          className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold"
                          style={{
                            backgroundColor: colorForAlias(account.alias),
                            color: 'var(--accent-foreground)',
                          }}
                        >
                          {account.alias.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {isSelected && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full"
                          style={{
                            backgroundColor: 'var(--success)',
                            border: '2px solid var(--bg-elevated)',
                          }}
                        >
                          <Check size={8} strokeWidth={4} style={{ color: 'white' }} />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <button
                      type="button"
                      onClick={() => handleSelect(account)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {account.alias}
                        </p>
                        {isSelected && (
                          <NexaBadge variant="success" size="sm">Activa</NexaBadge>
                        )}
                      </div>
                      <p className="text-[10px] text-foreground-muted font-mono truncate">
                        {account.username}@{account.domain}
                      </p>
                      <p className="text-[9px] text-foreground-subtle mt-0.5">
                        Último uso: {formatRelativeTime(account.lastUsed)}
                      </p>
                    </button>

                    {/* Actions menu */}
                    <div className="relative flex-shrink-0">
                      <button
                        ref={(el) => { menuButtonRefs.current[account.id] = el; }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === account.id ? null : account.id);
                        }}
                        className="flex items-center justify-center h-8 w-8 rounded-lg text-foreground-muted hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="Más opciones"
                      >
                        <MoreVertical size={16} />
                      </button>

                      <DropdownPortal
                        open={menuOpenId === account.id}
                        onClose={() => setMenuOpenId(null)}
                        triggerRef={{ current: menuButtonRefs.current[account.id] ?? null }}
                        align="right"
                        width={160}
                      >
                        <button
                          type="button"
                          onClick={() => handleEdit(account)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors cursor-pointer"
                          style={{ color: 'var(--foreground)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Pencil size={14} style={{ color: 'var(--foreground-muted)' }} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(account)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors cursor-pointer border-t"
                          style={{ color: 'var(--error)', borderColor: 'var(--border-subtle)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </DropdownPortal>
                    </div>
                  </div>
                </NexaCard>
              </StaggerItem>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AccountFormDialog
        open={showForm}
        onClose={handleCloseForm}
        editAccount={editAccount}
      />

      <AccountDeleteDialog
        open={!!deleteAccount}
        onClose={() => setDeleteAccount(null)}
        account={deleteAccount}
      />
    </div>
  );
}
