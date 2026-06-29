/**
 * NEXA NautaX — Account Form Dialog 
 *
 * Fixes:
 * - Avatar: reset file input tras eliminar para poder re-subir
 * - Edit: usa key={editAccount?.id} para reinicializar state
 * - Password strength: 5 niveles (very-strong requiere 12+ chars + upper + lower + digit + special)
 * - Checkbox reconexión desactivado por defecto
 */

import { useState, type FormEvent, useRef, useEffect } from 'react';
import { X, UserPlus, UserCog, Camera, AlertTriangle } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaInput } from '@/components/nexa/NexaInput';
import { NexaPasswordInput } from '@/components/nexa/NexaPasswordInput';
import { NexaUsernameField, type NautaDomain } from '@/components/nexa/NexaUsernameField';
import { useAccountStore } from '@/store/accountStore';
import { useToast } from '@/providers/ToastProvider';
import type { AccountSummary } from '@/modules/messaging/messageClient';

export interface AccountFormDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly editAccount?: AccountSummary | null;
}

function colorForAlias(alias: string): string {
  const colors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--info)', 'var(--primary)'];
  let hash = 0;
  for (let i = 0; i < alias.length; i++) hash = (hash * 31 + alias.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length]!;
}

// 5 niveles: weak, medium, strong, very-strong
function computeStrength(pwd: string): 'weak' | 'medium' | 'strong' | 'very-strong' {
  if (pwd.length < 8) return 'weak';
  let score = 0;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 1) return 'weak';
  if (score === 2) return 'medium';
  if (score === 3) return 'strong';
  return 'very-strong';
}

export function AccountFormDialog({ open, onClose, editAccount }: AccountFormDialogProps) {
  const create = useAccountStore((s) => s.create);
  const update = useAccountStore((s) => s.update);
  const loading = useAccountStore((s) => s.loading);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alias, setAlias] = useState('');
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState<NautaDomain>('nauta.com.cu');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Cuando se abre el modal o cambia editAccount, reinicializar state
  useEffect(() => {
    if (open) {
      setAlias(editAccount?.alias ?? '');
      setUsername(editAccount?.username ?? '');
      setDomain(editAccount?.domain ?? 'nauta.com.cu');
      setPassword('');
      setConfirmPassword('');
      setAvatar(editAccount?.avatar ?? null);
      setFormError(null);
    }
  }, [open, editAccount]);

  if (!open) return null;

  const isEdit = !!editAccount;
  const hasPasswordError = confirmPassword.length > 0 && password !== confirmPassword;
  const canSave = alias.trim().length > 0 && username.trim().length > 0 && (isEdit ? true : password.length > 0) && !hasPasswordError;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.warning('La imagen no puede superar 512KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      // Reset del input para permitir re-subir el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    // Reset del input para poder subir el mismo archivo de nuevo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!isEdit && password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return;
    }
    setFormError(null);

    const payload = {
      alias: alias.trim(),
      username: username.trim(),
      domain,
      ...(password ? { password } : {}),
      ...(avatar ? { avatar } : {}),
    };

    let result: { success: boolean; error?: string };
    if (isEdit && editAccount) {
      result = await update(editAccount.id, payload);
    } else {
      // Create requiere password
      result = await create({ ...payload, password: password || '' });
    }

    if (result.success) {
      toast.success(isEdit ? 'Cuenta actualizada' : 'Cuenta creada');
      onClose();
    } else {
      const errorMsg = result.error ?? 'Error al guardar la cuenta';
      setFormError(errorMsg);
      // Toast no persistente (se auto-dismiss)
      toast.error(errorMsg);
    }
  };

  const displayInitial = alias.charAt(0).toUpperCase() || '?';
  const strength = computeStrength(password);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated-2)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            {isEdit ? <UserCog size={18} style={{ color: 'var(--accent)' }} /> : <UserPlus size={18} style={{ color: 'var(--accent)' }} />}
            <h2 className="text-display text-base font-semibold text-foreground">{isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3.5">
          {/* Avatar picker */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="h-16 w-16 rounded-full object-cover" style={{ border: '2px solid var(--border-strong)' }} />
              ) : (
                <div className="flex items-center justify-center h-16 w-16 rounded-full text-xl font-bold" style={{ backgroundColor: colorForAlias(alias || '?'), color: 'var(--accent-foreground)' }}>
                  {displayInitial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex items-center justify-center h-6 w-6 rounded-full cursor-pointer transition-all"
                style={{ backgroundColor: 'var(--accent)', border: '2px solid var(--bg-elevated-2)' }}
                aria-label="Subir avatar"
              >
                <Camera size={12} style={{ color: 'var(--accent-foreground)' }} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">Avatar</p>
              <p className="text-[10px] text-foreground-muted">Opcional. Máx 512KB. Si no subes imagen, se usa la inicial del alias.</p>
              {avatar && (
                <button type="button" onClick={handleRemoveAvatar} className="text-[10px] text-error hover:underline mt-0.5">
                  Quitar avatar
                </button>
              )}
            </div>
          </div>

          <NexaInput id="account-alias" label="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: Personal, Trabajo..." autoFocus />

          <NexaUsernameField id="account-username" label="Usuario" value={username} domain={domain} onChange={(u, d) => { setUsername(u); setDomain(d); }} placeholder="pepe.perez" />

          <NexaPasswordInput id="account-password" label={isEdit ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña Nauta" showStrength={!isEdit && password.length > 0} strength={strength} />

          {!isEdit && (
            <NexaPasswordInput id="account-password-confirm" label="Confirmar contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" error={hasPasswordError ? 'Las contraseñas no coinciden' : undefined} />
          )}

          {/* Error inline */}
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}>
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2.5 pt-2">
            <NexaButton variant="ghost" fullWidth onClick={onClose}>Cancelar</NexaButton>
            <NexaButton variant="primary" fullWidth glow type="submit" loading={loading} disabled={!canSave}>{isEdit ? 'Guardar cambios' : 'Crear cuenta'}</NexaButton>
          </div>
        </form>
      </div>
    </div>
  );
}
