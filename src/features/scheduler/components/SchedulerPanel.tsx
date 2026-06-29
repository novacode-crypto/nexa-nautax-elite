/**
 * NEXA NautaX — Scheduler View (SidePanel) — Premium v2
 */

import { Calendar, Clock, Timer } from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { NexaEmptyState } from '@/components/nexa/NexaEmptyState';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { useToast } from '@/providers/ToastProvider';

export function SchedulerView() {
  const toast = useToast();

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <StaggerItem index={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display text-2xl font-bold tracking-tight mb-1">Programación</h1>
            <p className="text-sm text-foreground-muted">Programa desconexiones automáticas.</p>
          </div>
          <NexaButton
            variant="primary"
            size="sm"
            icon={<Calendar size={14} />}
            onClick={() => toast.info('Función disponible en Fase 7')}
          >
            Nueva
          </NexaButton>
        </div>
      </StaggerItem>

      <StaggerItem index={1}>
        <NexaCard padding="lg">
          <NexaEmptyState
            icon={<Timer size={48} className="text-foreground-subtle" />}
            title="Sin programaciones"
            description="Programa desconexiones automáticas para no consumir saldo innecesariamente."
            action={{ label: '+ Nueva programación', onClick: () => toast.info('Fase 7') }}
          />
        </NexaCard>
      </StaggerItem>

      <StaggerItem index={2}>
        <div>
          <h2 className="text-display text-base font-semibold tracking-tight mb-3">
            Desconexión rápida
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {[30, 60, 120].map((min) => (
              <NexaCard
                key={min}
                padding="md"
                variant="interactive"
                className="text-center"
                onClick={() => toast.info(`Logout en ${min} min — Fase 7`)}
              >
                <Clock size={20} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                <p className="text-display text-lg font-semibold text-foreground">{min}</p>
                <p className="text-xs text-foreground-muted">minutos</p>
              </NexaCard>
            ))}
          </div>
        </div>
      </StaggerItem>

      <StaggerItem index={3}>
        <div>
          <h2 className="text-display text-base font-semibold tracking-tight mb-3">
            Vista previa — Tarea activa
          </h2>
          <NexaCard padding="md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Timer size={20} style={{ color: 'var(--accent)' }} className="mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Desconectar en 60 min</p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Cuenta: <span className="font-mono">pepe.perez@nauta.com.cu</span>
                  </p>
                  <p className="text-xs text-foreground-muted">
                    Cierra aprox: <span className="font-mono">14:32</span>
                  </p>
                  <p
                    className="text-display text-lg font-semibold mt-1 font-mono"
                    style={{ color: 'var(--accent)' }}
                  >
                    45:23
                  </p>
                </div>
              </div>
              <NexaBadge variant="primary" className="flex-shrink-0">Activa</NexaBadge>
            </div>
          </NexaCard>
        </div>
      </StaggerItem>
    </div>
  );
}
