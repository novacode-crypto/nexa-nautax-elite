/**
 * NEXA NautaX — Danger Confirm Dialog
 *
 * Diálogo reutilizable para confirmar acciones destructivas.
 * Requiere que el usuario escriba una palabra clave para confirmar.
 */

import { useState, type FormEvent, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaInput } from '@/components/nexa/NexaInput';

export interface DangerConfirmDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly message: string;
  readonly confirmWord: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => Promise<void> | void;
}

export function DangerConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmWord,
  confirmLabel,
  onConfirm,
}: DangerConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  if (!open) return null;

  const canConfirm = typed.trim().toLowerCase() === confirmWord.toLowerCase();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-elevated-2)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 20px 40px -10px rgba(239, 68, 68, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3.5">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>

          <div
            className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--error)',
            }}
          >
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Para confirmar, escribe <strong className="font-mono">{confirmWord}</strong> en el campo de abajo.
            </span>
          </div>

          <NexaInput
            id="danger-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmWord}
            autoComplete="off"
            autoFocus
          />

          <div className="flex gap-2.5 pt-2">
            <NexaButton variant="ghost" fullWidth onClick={onClose}>
              Cancelar
            </NexaButton>
            <NexaButton
              variant="danger"
              fullWidth
              glow
              type="submit"
              loading={loading}
              disabled={!canConfirm}
            >
              {confirmLabel}
            </NexaButton>
          </div>
        </form>
      </div>
    </div>
  );
}
