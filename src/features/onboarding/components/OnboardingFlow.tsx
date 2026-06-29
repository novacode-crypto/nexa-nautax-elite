/**
 * NEXA NautaX — OnboardingFlow 
 *
 * Cifrado transparente: sin contraseña maestra, sin mode-select.
 * Flujo: welcome → setup → done.
 * El cifrado AES-256 se activa automáticamente con clave derivada del installationId.
 */

import { useState, useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaLogo } from '@/components/nexa/NexaLogo';
import { ThemeSelectorGrid } from '@/components/layout/ThemeToggle';
import { useCryptoStore } from '@/store/cryptoStore';
import { useToast } from '@/providers/ToastProvider';

type Step = 'welcome' | 'setup' | 'done';

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome');
  const createMaster = useCryptoStore((s) => s.createMaster);
  const toast = useToast();

  const handleSetup = async () => {
    setStep('setup');
    // Cifrado transparente: contraseña vacía → CryptoService deriva clave del installationId
    const ok = await createMaster('');
    if (ok) {
      toast.success('Cifrado AES-256 activado');
      setStep('done');
    } else {
      toast.error('Error en setup');
      setStep('welcome');
    }
  };

  useEffect(() => {
    if (step === 'setup') {
      const t = setTimeout(() => setStep('done'), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  // —— Welcome ——
  if (step === 'welcome') {
    return (
      <div className="flex flex-col gap-5 items-center text-center w-full h-full justify-center">
        {/* Icono de la extensión (tematizado con variables CSS del tema activo) */}
        <NexaLogo variant="icon" size="xl" glow className="h-20 w-20" />
        <div>
          <h1 className="text-display text-xl font-bold tracking-tight mb-1">
            Bienvenido a <span className="text-gradient">NEXA NautaX ELITE</span>
          </h1>
          <p className="text-sm text-foreground-muted max-w-xs">
            Administra tus cuentas Nauta con elegancia y seguridad.
          </p>
        </div>
        <div className="w-full">
          <p className="text-[10px] uppercase tracking-widest font-medium text-foreground-muted mb-2 text-center">
            Elige tu tema
          </p>
          <ThemeSelectorGrid />
        </div>
        <NexaButton variant="primary" fullWidth size="lg" glow onClick={handleSetup} iconRight={<ChevronRight size={16} />}>
          Comenzar
        </NexaButton>
      </div>
    );
  }

  // —— Setup loading ——
  if (step === 'setup') {
    return (
      <div className="flex flex-col gap-4 items-center text-center w-full h-full justify-center">
        <NexaLogo variant="icon" size="xl" glow className="h-20 w-20 animate-pulse" />
        <div>
          <h1 className="text-display text-xl font-bold tracking-tight mb-1">Configurando...</h1>
          <p className="text-sm text-foreground-muted">Activando cifrado AES-256 local</p>
        </div>
      </div>
    );
  }

  // —— Done ——
  return (
    <div className="flex flex-col gap-4 items-center text-center w-full h-full justify-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
        <Check size={32} style={{ color: 'var(--success)' }} />
      </div>
      <div>
        <h1 className="text-display text-xl font-bold tracking-tight mb-1">¡Listo!</h1>
        <p className="text-sm text-foreground-muted max-w-xs">NEXA NautaX ELITE está listo para usar. Agrega tu primera cuenta Nauta para comenzar.</p>
      </div>
      <NexaButton variant="primary" fullWidth size="lg" glow onClick={() => window.close()}>
        Comenzar a usar
      </NexaButton>
    </div>
  );
}
