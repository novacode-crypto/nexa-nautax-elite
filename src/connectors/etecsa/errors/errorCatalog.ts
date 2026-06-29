/**
 * NEXA NautaX — ETECSA Error Catalog (mensajes español → código)
 *  — Doc 1 §5 +  — Doc 4 §5
 *
 * Mapea mensajes de alerta JavaScript de ETECSA a códigos NEXA.
 * Tolerante a typos conocidos de ETECSA (ej: "a realizado" vs "ha realizado").
 */

import type { EtecsaErrorCode } from '../contracts/types';

interface CatalogEntry {
  readonly code: EtecsaErrorCode;
  readonly patterns: readonly string[];
  readonly maxDistance: number;
}

// ═══ Catálogo — strings normalizados (sin acentos, lowercase) ══════

const ERROR_CATALOG: readonly CatalogEntry[] = [
  {
    code: 'AUTH_INVALID_CREDENTIALS',
    patterns: ['usuario o la contrasena son incorrectos'],
    maxDistance: 3,
  },
  {
    code: 'AUTH_RATE_LIMITED',
    // ETECSA escribe "a realizado" (typo) — ambos patterns cubiertos
    patterns: ['usted a realizado muchos intentos', 'usted ha realizado muchos intentos'],
    maxDistance: 2,
  },
  {
    code: 'BALANCE_ZERO',
    patterns: ['no existen saldos suficientes en la cuenta'],
    maxDistance: 3,
  },
  {
    code: 'AUTH_ACCOUNT_BLOCKED',
    patterns: ['cuenta se encuentra bloqueada'],
    maxDistance: 2,
  },
  {
    code: 'SESSION_EXPIRED',
    patterns: ['sesion ha expirado'],
    maxDistance: 2,
  },
  {
    code: 'SESSION_IN_USE',
    patterns: ['usuario ya tiene una sesion activa', 'ya tiene una sesion activa'],
    maxDistance: 3,
  },
];

// ═══ Normalización ═════════════════════════════════════════════════

/**
 * Normaliza un string para matching tolerante:
 * - lowercase
 * - sin diacríticos (NFD + strip combining marks)
 * - whitespace colapsado
 * - sin puntuación
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══ Distancia de Levenshtein ═════════════════════════════════════

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

// ═══ Búsqueda ══════════════════════════════════════════════════════

/**
 * Busca el código de error que mejor matchea el mensaje dado.
 * Retorna null si no hay match dentro de la tolerancia.
 */
export function findErrorByMessage(rawMessage: string): EtecsaErrorCode | null {
  const normalized = normalize(rawMessage);
  if (normalized.length === 0) return null;

  for (const entry of ERROR_CATALOG) {
    for (const pattern of entry.patterns) {
      // Si el mensaje contiene el pattern como substring → match directo
      if (normalized.includes(pattern)) {
        return entry.code;
      }
      // Si están cerca por Levenshtein → match tolerante
      const distance = levenshtein(normalized, pattern);
      if (distance <= entry.maxDistance) {
        return entry.code;
      }
    }
  }
  return null;
}

/**
 * Versión que siempre retorna un código (UNKNOWN_ETECSA si no hay match).
 */
export function mapMessageToCode(rawMessage: string): EtecsaErrorCode {
  return findErrorByMessage(rawMessage) ?? 'AUTH_UNKNOWN_FAILURE';
}
