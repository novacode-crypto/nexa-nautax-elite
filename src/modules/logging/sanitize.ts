/**
 * NEXA NautaX — Log sanitizer
 * Fase 2 — F2-D18
 *
 * Sanitiza strings antes de loggear para evitar exponer datos sensibles.
 */

// —— Patrones a sanitizar ————————————————————————————————————————

interface SanitizePattern {
  readonly pattern: RegExp;
  readonly replacement: string;
}

const SANITIZE_PATTERNS: readonly SanitizePattern[] = [
  // Passwords en query strings o bodies
  { pattern: /password=[^&\s]+/gi, replacement: 'password=***' },
  // Token CSRF de ETECSA
  { pattern: /CSRFHW=[a-f0-9]+/gi, replacement: 'CSRFHW=***' },
  // Token de sesión ETECSA
  { pattern: /ATTRIBUTE_UUID=[a-zA-Z0-9]+/gi, replacement: 'ATTRIBUTE_UUID=***' },
  // Cookie JSESSIONID
  { pattern: /JSESSIONID=[a-zA-Z0-9._-]+/gi, replacement: 'JSESSIONID=***' },
  // Emails (Nauta)
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '***@***',
  },
  // IPs IPv4
  {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: '***.***.***.***',
  },
];

// —— API ————————————————————————————————————————————————————————

export function sanitize(input: string): string {
  return SANITIZE_PATTERNS.reduce((acc, { pattern, replacement }) => acc.replace(pattern, replacement), input);
}

export function sanitizeObject(input: unknown): unknown {
  if (typeof input === 'string') {
    return sanitize(input);
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeObject);
  }
  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        sanitizeObject(value),
      ]),
    );
  }
  return input;
}
