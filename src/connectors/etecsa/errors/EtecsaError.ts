/**
 * NEXA NautaX — ETECSA Error
 *  — Doc 2 §2.4 +  — Doc 4
 *
 * Catálogo estático + factory para errores del ETECSA connector.
 * Los mensajes en español están mapeados aquí.
 */

import type {
  EtecsaError,
  EtecsaErrorCategory,
  EtecsaErrorCode,
} from '../contracts/types';

// ═══ Catálogo estático — mensajes en español ═══════════════════════

export const ETECSA_ERROR_CATALOG: Readonly<
  Record<EtecsaErrorCode, {
    category: EtecsaErrorCategory;
    userMessage: string;
    recommendedAction: string;
    retryable: boolean;
  }>
> = {
  // —— AUTH ——
  AUTH_INVALID_CREDENTIALS: {
    category: 'AUTH_ERROR',
    userMessage: 'Las credenciales son incorrectas.',
    recommendedAction: 'Verifica tu usuario y contraseña.',
    retryable: false,
  },
  AUTH_RATE_LIMITED: {
    category: 'AUTH_ERROR',
    userMessage: 'ETECSA ha limitado los intentos.',
    recommendedAction: 'Espera unos minutos antes de intentar de nuevo.',
    retryable: true,
  },
  AUTH_ACCOUNT_BLOCKED: {
    category: 'AUTH_ERROR',
    userMessage: 'La cuenta está bloqueada.',
    recommendedAction: 'Contacta a ETECSA para desbloquear tu cuenta.',
    retryable: false,
  },
  AUTH_UNKNOWN_FAILURE: {
    category: 'AUTH_ERROR',
    userMessage: 'No se pudo iniciar sesión.',
    recommendedAction: 'Intenta de nuevo. Si persiste, revisa Developer Mode.',
    retryable: true,
  },
  // —— SESSION ——
  SESSION_EXPIRED: {
    category: 'SESSION_ERROR',
    userMessage: 'La sesión ha expirado.',
    recommendedAction: 'ETECSA cerró la sesión. Puedes reconectar.',
    retryable: true,
  },
  SESSION_IN_USE: {
    category: 'SESSION_ERROR',
    userMessage: 'La cuenta tiene sesión activa en otro dispositivo.',
    recommendedAction: 'Puedes forzar el cierre remoto de la otra sesión.',
    retryable: false,
  },
  SESSION_NOT_FOUND: {
    category: 'SESSION_ERROR',
    userMessage: 'No hay sesión activa.',
    recommendedAction: 'Conecta una cuenta primero.',
    retryable: false,
  },
  // —— NETWORK ——
  NETWORK_TIMEOUT: {
    category: 'NETWORK_ERROR',
    userMessage: 'La conexión con ETECSA tardó demasiado.',
    recommendedAction: 'Verifica tu conexión a internet.',
    retryable: true,
  },
  NETWORK_DNS: {
    category: 'NETWORK_ERROR',
    userMessage: 'No se pudo resolver el servidor ETECSA.',
    recommendedAction: 'Verifica tu conexión WiFi Nauta.',
    retryable: true,
  },
  NETWORK_OFFLINE: {
    category: 'NETWORK_ERROR',
    userMessage: 'Sin conexión con ETECSA.',
    recommendedAction: 'Conéctate a una red WiFi Nauta.',
    retryable: false,
  },
  PORTAL_UNREACHABLE: {
    category: 'NETWORK_ERROR',
    userMessage: 'El portal ETECSA no responde.',
    recommendedAction: 'ETECSA podría estar teniendo problemas.',
    retryable: true,
  },
  // —— CONNECTOR ——
  CONNECTOR_PARSER_FAILED: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'El portal ETECSA ha cambiado.',
    recommendedAction: 'NEXA NautaX ELITE no puede interpretar la respuesta.',
    retryable: false,
  },
  CONNECTOR_CSRF_MISSING: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'Error al leer el formulario de ETECSA.',
    recommendedAction: 'Intenta de nuevo.',
    retryable: true,
  },
  CONNECTOR_ATTRIBUTE_UUID_MISSING: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'No se pudo completar el inicio de sesión.',
    recommendedAction: 'ETECSA respondió de forma inesperada.',
    retryable: true,
  },
  CONNECTOR_DEGRADED: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'El connector ETECSA está experimentando problemas.',
    recommendedAction: 'Algunas funciones pueden no estar disponibles.',
    retryable: true,
  },
  // —— BALANCE ——
  BALANCE_ZERO: {
    category: 'BALANCE_ERROR',
    userMessage: 'Saldo insuficiente.',
    recommendedAction: 'Recarga tu cuenta Nauta o cambia de cuenta.',
    retryable: false,
  },
  BALANCE_UNAVAILABLE: {
    category: 'BALANCE_ERROR',
    userMessage: 'No se pudo obtener el saldo.',
    recommendedAction: 'El saldo se actualizará en el próximo intento.',
    retryable: true,
  },
  // —— UNKNOWN ——
  UNKNOWN_ETECSA: {
    category: 'UNKNOWN_ERROR',
    userMessage: 'Ocurrió un error inesperado con ETECSA.',
    recommendedAction: 'Intenta de nuevo.',
    retryable: true,
  },
};

// ═══ Factory ═══════════════════════════════════════════════════════

export function makeEtecsaError(
  code: EtecsaErrorCode,
  technicalMessage: string,
  options?: { cause?: unknown; traceId?: string },
): EtecsaError {
  const catalog = ETECSA_ERROR_CATALOG[code];
  return {
    code,
    category: catalog.category,
    technicalMessage,
    userMessage: catalog.userMessage,
    recommendedAction: catalog.recommendedAction,
    retryable: catalog.retryable,
    timestamp: Date.now(),
    ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    ...(options?.traceId !== undefined ? { traceId: options.traceId } : {}),
  };
}

export function toEtecsaError(unknown: unknown, traceId?: string): EtecsaError {
  if (unknown instanceof Error) {
    return makeEtecsaError('UNKNOWN_ETECSA', unknown.message, {
      cause: unknown,
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  return makeEtecsaError(
    'UNKNOWN_ETECSA',
    String(unknown),
    traceId !== undefined ? { traceId } : undefined,
  );
}
