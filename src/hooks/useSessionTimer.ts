/**
 * NEXA NautaX — useSessionTimer
 *
 * Cronómetro en vivo con dos modos:
 *  - Solo startedAt: cuenta tiempo transcurrido (conectado) hacia arriba
 *  - startedAt + totalSeconds: también calcula tiempo restante hacia abajo
 *
 * Se actualiza cada segundo.
 */

import { useState, useEffect } from 'react';

export interface SessionTimer {
  /** Segundos transcurridos desde startedAt */
  readonly elapsedSeconds: number;
  /** Formato HH:MM:SS del tiempo transcurrido */
  readonly elapsedFormatted: string;
  /** Formato compacto: "1h 23m" o "5m 30s" */
  readonly elapsedCompact: string;
  /** Segundos restantes (null si no se especificó totalSeconds) */
  readonly remainingSeconds: number | null;
  /** Formato HH:MM:SS del tiempo restante (null si no aplica) */
  readonly remainingFormatted: string | null;
  /** Formato compacto del tiempo restante */
  readonly remainingCompact: string | null;
  /** Alias de elapsedFormatted (para compatibilidad con el popup) */
  readonly connectedFormatted: string;
}

function formatHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCompact(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function useSessionTimer(
  startedAt: number | null,
  totalSeconds: number | null = null,
): SessionTimer {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === null) {
    return {
      elapsedSeconds: 0,
      elapsedFormatted: '00:00:00',
      elapsedCompact: '0s',
      remainingSeconds: totalSeconds,
      remainingFormatted: totalSeconds !== null ? formatHHMMSS(totalSeconds) : null,
      remainingCompact: totalSeconds !== null ? formatCompact(totalSeconds) : null,
      connectedFormatted: '00:00:00',
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const remainingSeconds =
    totalSeconds !== null ? Math.max(0, totalSeconds - elapsedSeconds) : null;

  return {
    elapsedSeconds,
    elapsedFormatted: formatHHMMSS(elapsedSeconds),
    elapsedCompact: formatCompact(elapsedSeconds),
    remainingSeconds,
    remainingFormatted: remainingSeconds !== null ? formatHHMMSS(remainingSeconds) : null,
    remainingCompact: remainingSeconds !== null ? formatCompact(remainingSeconds) : null,
    connectedFormatted: formatHHMMSS(elapsedSeconds),
  };
}
