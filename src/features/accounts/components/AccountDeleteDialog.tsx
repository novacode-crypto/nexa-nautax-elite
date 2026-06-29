/**
 * NEXA NautaX — Account Delete Dialog — v5
 * + Muestra avatar de la cuenta
 */

import { useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { useAccountStore } from '@/store/accountStore';
import { useToast } from '@/providers/ToastProvider';
import type { AccountSummary } from '@/modules/messaging/messageClient';

function colorForAlias(alias: string): string {
  const colors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--info)', 'var(--primary)'];
  let hash = 0;
  for (let i = 0; i < alias.length; i++) hash = (hash * 31 + alias.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length]!;
}

export interface AccountDeleteDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly account: AccountSummary | null;
}

export function AccountDeleteDialog({ open, onClose, account }: AccountDeleteDialogProps) {
  const remove = useAccountStore((s) => s.remove);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!open || !account) return null;

  const handleDelete = async () => {
    setLoading(true);
    await remove(account.id);
    setLoading(false);
    toast.success('Cuenta eliminada');
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated-2)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--error)' }} />
            </div>
            <h2 className="text-display text-base font-semibold text-foreground">Eliminar cuenta</h2>
          </div>
          <button type="button" onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          <p className="text-sm text-foreground-muted">
            ¿Estás seguro de que quieres eliminar la cuenta{' '}
            <span className="font-semibold text-foreground">"{account.alias}"</span>?
          </p>

          {/* Info de la cuenta con avatar */}
          <div className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {account.avatar ? (
              <img src={account.avatar} alt={account.alias} className="h-9 w-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
            ) : (
              <div className="flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold flex-shrink-0" style={{ backgroundColor: colorForAlias(account.alias), color: 'var(--accent-foreground)' }}>
                {account.alias.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{account.alias}</p>
              <p className="text-[10px] text-foreground-muted font-mono truncate">{account.username}@{account.domain}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>Esta acción no se puede deshacer. Si hay una sesión activa con esta cuenta, se cerrará automáticamente.</span>
          </div>

          <div className="flex gap-2.5 pt-1">
            <NexaButton variant="ghost" fullWidth onClick={onClose}>Cancelar</NexaButton>
            <NexaButton variant="danger" fullWidth glow loading={loading} onClick={handleDelete} icon={<Trash2 size={16} />}>Eliminar</NexaButton>
          </div>
        </div>
      </div>
    </div>
  );
}
