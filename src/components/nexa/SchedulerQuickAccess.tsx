/**
 * NEXA NautaX — Scheduler Quick Access — v3
 *
 * + Dial horizontal arrastrable (drag + click)
 * + Pasos de 15 min, max 2h
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X, Timer, AlertCircle } from 'lucide-react';
import { NexaButton } from '@/components/nexa/NexaButton';
import { useToast } from '@/providers/ToastProvider';

export interface ScheduledDisconnect {
  minutes: number;
  setAt: number;
}

interface SchedulerQuickAccessProps {
  onSchedule: (minutes: number) => void;
  onCancel: () => void;
  active?: ScheduledDisconnect | null;
}

const MAX_MINUTES = 120;
const STEP_MINUTES = 15;
const STEPS = MAX_MINUTES / STEP_MINUTES; // 8 steps

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function SchedulerQuickAccess({ onSchedule, onCancel, active }: SchedulerQuickAccessProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedStep, setSelectedStep] = useState(4); // default: 60 min
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  // Calcular step desde posición X del mouse
  const getStepFromX = useCallback((clientX: number): number => {
    if (!trackRef.current) return selectedStep;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const step = Math.round(percent * STEPS);
    return Math.max(0, Math.min(STEPS, step));
  }, [selectedStep]);

  // Handlers de drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const step = getStepFromX(e.clientX);
    setSelectedStep(step);
  }, [getStepFromX]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const step = getStepFromX(e.clientX);
      setSelectedStep(step);
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, getStepFromX]);

  // Si hay programación activa
  if (active) {
    const totalMs = active.minutes * 60 * 1000;
    const elapsedMs = now - active.setAt;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const percent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

    return (
      <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
        <Timer size={16} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-widest font-medium text-foreground-muted">Desconexión en</p>
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{formatCountdown(remainingMs)}</p>
          </div>
          <div className="w-full rounded-full h-1 overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percent}%`, backgroundImage: 'var(--primary-gradient)' }} />
          </div>
        </div>
        <button type="button" onClick={() => { onCancel(); toast.info('Desconexión cancelada'); }} className="flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 transition-colors cursor-pointer" style={{ color: 'var(--foreground-muted)' }} aria-label="Cancelar"><X size={14} /></button>
      </div>
    );
  }

  const selectedMinutes = selectedStep * STEP_MINUTES;

  return (
    <>
      {/* Texto link — no botón ni card */}
      <button type="button" onClick={() => setShowPanel(true)} className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-accent transition-colors cursor-pointer">
        <Calendar size={12} style={{ color: 'var(--accent)' }} />
        <span className="underline-offset-2 hover:underline">Programar desconexión</span>
      </button>

      {/* Modal via portal a document.body — escapar del overflow del popup */}
      {showPanel && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: 100000, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPanel(false)}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated-2)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2.5">
                <Calendar size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-display text-base font-semibold text-foreground">Programar desconexión</h2>
              </div>
              <button type="button" onClick={() => setShowPanel(false)} className="text-foreground-muted hover:text-foreground transition-colors"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Tiempo seleccionado */}
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">Desconectar en</p>
                <p className="text-display text-3xl font-bold" style={{ backgroundImage: 'var(--gradient-text-primary)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {formatMinutes(selectedMinutes)}
                </p>
              </div>

              {/* Dial arrastrable */}
              <div className="py-2">
                <div
                  ref={trackRef}
                  className="relative h-2 rounded-full cursor-pointer touch-none"
                  style={{ backgroundColor: 'var(--muted)' }}
                  onPointerDown={handlePointerDown}
                >
                  {/* Fill */}
                  <div className="absolute left-0 top-0 h-2 rounded-full pointer-events-none" style={{ width: `${(selectedStep / STEPS) * 100}%`, backgroundImage: 'var(--primary-gradient)' }} />

                  {/* Dial handle */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-transform pointer-events-none"
                    style={{
                      left: `${(selectedStep / STEPS) * 100}%`,
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'var(--accent)',
                      border: '3px solid var(--bg-elevated-2)',
                      boxShadow: 'var(--glow-accent)',
                      ...(isDragging ? { transform: 'translate(-50%, -50%) scale(1.2)' } : {}),
                    }}
                  />
                </div>

                {/* Labels */}
                <div className="flex justify-between mt-3 px-0">
                  <span className="text-[9px] text-foreground-subtle font-mono">0</span>
                  <span className="text-[9px] text-foreground-subtle font-mono">30m</span>
                  <span className="text-[9px] text-foreground-subtle font-mono">1h</span>
                  <span className="text-[9px] text-foreground-subtle font-mono">1h30</span>
                  <span className="text-[9px] text-foreground-subtle font-mono">2h</span>
                </div>
              </div>

              {/* Aviso */}
              <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                <span className="text-foreground-muted">Se notificará 5 minutos antes de la desconexión automática.</span>
              </div>

              <NexaButton
                variant="primary"
                fullWidth
                glow
                disabled={selectedMinutes === 0}
                onClick={() => {
                  onSchedule(selectedMinutes);
                  setShowPanel(false);
                  toast.success(`Desconexión programada en ${formatMinutes(selectedMinutes)}`);
                }}
              >
                Programar
              </NexaButton>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
