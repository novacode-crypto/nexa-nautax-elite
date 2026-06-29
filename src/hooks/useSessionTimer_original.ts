/**
 * NEXA NautaX — useSessionTimer
 *
 * Cronómetro en vivo que cuenta el tiempo transcurrido desde startedAt.
 * Se actualiza cada segundo.
 * Retorna el elapsed time en formato HH:MM:SS y en segundos.
 */

import { useState, useEffect } from 'react';

export interface SessionTimer {
  /** Segundos transcurridos desde startedAt */
  readonly elapsedSeconds: number;
  /** Formato HH:MM:SS */
  readonly elapsedFormatted: string;
  /** Formato compacto: "1h 23m" o "5m 30s" */
  readonly elapsedCompact: string;
}

function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCompact(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function useSessionTimer(startedAt: number | null): SessionTimer {
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
    };
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return {
    elapsedSeconds,
    elapsedFormatted: formatHHMMSS(elapsedSeconds),
    elapsedCompact: formatCompact(elapsedSeconds),
  };
}
