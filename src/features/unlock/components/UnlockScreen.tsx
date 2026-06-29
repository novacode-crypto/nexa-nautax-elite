/**
 * NEXA NautaX — UnlockScreen 
 *
 * Con padding para no ocupar todo el ancho sin márgenes.
 */

import { useState, useEffect } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaPasswordInput } from '@/components/nexa/NexaPasswordInput';
import { useCryptoStore } from '@/store/cryptoStore';
import { useToast } from '@/providers/ToastProvider';

export function UnlockScreen() {
  const [password, setPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const unlock = useCryptoStore((s) => s.unlock);
  const loading = useCryptoStore((s) => s.loading);
  const toast = useToast();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleUnlock = async () => {
    if (!password) {
      toast.warning('Ingresa tu contraseña maestra');
      return;
    }
    if (cooldown > 0) return;

    const ok = await unlock(password);
    if (ok) {
      toast.success('Desbloqueado');
      setPassword('');
    } else {
      toast.error('Contraseña incorrecta');
      setPassword('');
      setCooldown(30);
    }
  };

  return (
    <div className="flex flex-col gap-4 items-center text-center py-4 px-1 w-full h-full justify-center">
      <div
        className="flex items-center justify-center h-16 w-16 rounded-2xl"
        style={{
          backgroundColor: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
        }}
      >
        <Lock size={28} style={{ color: 'var(--accent)' }} />
      </div>

      <div>
        <h1 className="text-display text-xl font-bold tracking-tight mb-1">
          NEXA NautaX ELITE bloqueado
        </h1>
        <p className="text-xs text-foreground-muted">
          Ingresa tu contraseña maestra para continuar
        </p>
      </div>

      <div className="w-full">
        <NexaPasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña maestra"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUnlock();
          }}
          autoFocus
        />
      </div>

      {cooldown > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs w-full"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--error)',
          }}
        >
          <AlertCircle size={14} />
          Demasiados intentos. Espera {cooldown}s
        </div>
      )}

      <NexaButton
        variant="primary"
        fullWidth
        size="lg"
        glow
        loading={loading}
        disabled={!password || cooldown > 0}
        onClick={handleUnlock}
      >
        Desbloquear
      </NexaButton>

      <button
        type="button"
        className="text-xs text-foreground-muted hover:text-foreground"
        onClick={() => toast.info('Restablecer elimina todos los datos')}
      >
        ¿Olvidaste tu contraseña?
      </button>
    </div>
  );
}
