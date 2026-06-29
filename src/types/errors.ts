/**
 * NEXA NautaX — Error types
 *  — Doc 4
 */

export type NexaErrorCategory =
  | 'AUTH_ERROR'
  | 'SESSION_ERROR'
  | 'NETWORK_ERROR'
  | 'CONNECTOR_ERROR'
  | 'STORAGE_ERROR'
  | 'CRYPTO_ERROR'
  | 'SCHEDULER_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export type NexaErrorCode =
  // AUTH
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_ACCOUNT_BLOCKED'
  | 'AUTH_UNKNOWN_FAILURE'
  // SESSION
  | 'SESSION_EXPIRED'
  | 'SESSION_IN_USE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_ACTIVE'
  // NETWORK
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_DNS'
  | 'NETWORK_OFFLINE'
  | 'PORTAL_UNREACHABLE'
  // CONNECTOR
  | 'CONNECTOR_PARSER_FAILED'
  | 'CONNECTOR_CSRF_MISSING'
  | 'CONNECTOR_ATTRIBUTE_UUID_MISSING'
  | 'CONNECTOR_DEGRADED'
  // BALANCE
  | 'BALANCE_ZERO'
  | 'BALANCE_UNAVAILABLE'
  // STORAGE
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_FULL'
  | 'STORAGE_CORRUPT'
  // CRYPTO
  | 'CRYPTO_INVALID_MASTER_PASSWORD'
  | 'CRYPTO_NOT_INITIALIZED'
  | 'CRYPTO_LOCKED'
  | 'CRYPTO_DECRYPT_FAILED'
  | 'CRYPTO_ENCRYPT_FAILED'
  // SCHEDULER
  | 'SCHEDULER_TASK_NOT_FOUND'
  | 'SCHEDULER_INVALID_TRIGGER'
  // VALIDATION
  | 'VALIDATION_FAILED'
  // BACKUP
  | 'BACKUP_CHECKSUM_MISMATCH'
  | 'BACKUP_INVALID_FORMAT'
  // UNKNOWN
  | 'UNKNOWN_ERROR';

export interface NexaError {
  readonly code: NexaErrorCode;
  readonly category: NexaErrorCategory;
  readonly technicalMessage: string;
  readonly userMessage: string;
  readonly recommendedAction: string;
  readonly retryable: boolean;
  readonly cause?: unknown | undefined;
  readonly timestamp: number;
  readonly traceId?: string | undefined;
}

// —— Catálogo estático ————————————————————————————————————————

export const ERROR_CATALOG: Readonly<
  Record<NexaErrorCode, { category: NexaErrorCategory; userMessage: string; recommendedAction: string; retryable: boolean }>
> = {
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
    recommendedAction: 'Intenta de nuevo. Si el problema persiste, revisa Developer Mode.',
    retryable: true,
  },
  SESSION_EXPIRED: {
    category: 'SESSION_ERROR',
    userMessage: 'La sesión ha expirado.',
    recommendedAction: 'ETECSA cerró la sesión. Puedes reconectar manualmente.',
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
  SESSION_ALREADY_ACTIVE: {
    category: 'SESSION_ERROR',
    userMessage: 'Ya hay una sesión activa.',
    recommendedAction: 'Desconecta la sesión actual antes de iniciar una nueva.',
    retryable: false,
  },
  NETWORK_TIMEOUT: {
    category: 'NETWORK_ERROR',
    userMessage: 'La conexión con ETECSA tardó demasiado.',
    recommendedAction: 'Verifica tu conexión a internet e inténtalo de nuevo.',
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
    recommendedAction: 'Conéctate a una red WiFi Nauta para usar esta función.',
    retryable: false,
  },
  PORTAL_UNREACHABLE: {
    category: 'NETWORK_ERROR',
    userMessage: 'El portal ETECSA no responde.',
    recommendedAction: 'ETECSA podría estar teniendo problemas. Inténtalo más tarde.',
    retryable: true,
  },
  CONNECTOR_PARSER_FAILED: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'El portal ETECSA ha cambiado.',
    recommendedAction: 'NEXA NautaX ELITE no puede interpretar la respuesta de ETECSA.',
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
    recommendedAction: 'ETECSA respondió de forma inesperada. Intenta de nuevo.',
    retryable: true,
  },
  CONNECTOR_DEGRADED: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'El connector ETECSA está experimentando problemas.',
    recommendedAction: 'Algunas funciones pueden no estar disponibles.',
    retryable: true,
  },
  BALANCE_ZERO: {
    category: 'UNKNOWN_ERROR',
    userMessage: 'Saldo insuficiente.',
    recommendedAction: 'Recarga tu cuenta Nauta o cambia a otra cuenta.',
    retryable: false,
  },
  BALANCE_UNAVAILABLE: {
    category: 'CONNECTOR_ERROR',
    userMessage: 'No se pudo obtener el saldo.',
    recommendedAction: 'El saldo se actualizará en el próximo intento.',
    retryable: true,
  },
  STORAGE_WRITE_FAILED: {
    category: 'STORAGE_ERROR',
    userMessage: 'No se pudieron guardar los datos.',
    recommendedAction: 'Intenta de nuevo. Si persiste, libera espacio.',
    retryable: true,
  },
  STORAGE_READ_FAILED: {
    category: 'STORAGE_ERROR',
    userMessage: 'No se pudieron leer los datos.',
    recommendedAction: 'Reinicia la extensión.',
    retryable: true,
  },
  STORAGE_FULL: {
    category: 'STORAGE_ERROR',
    userMessage: 'Espacio de almacenamiento lleno.',
    recommendedAction: 'Limpia logs o historial desde Developer Mode.',
    retryable: false,
  },
  STORAGE_CORRUPT: {
    category: 'STORAGE_ERROR',
    userMessage: 'Los datos están corruptos.',
    recommendedAction: 'Restablece la extensión.',
    retryable: false,
  },
  CRYPTO_INVALID_MASTER_PASSWORD: {
    category: 'CRYPTO_ERROR',
    userMessage: 'Contraseña maestra incorrecta.',
    recommendedAction: 'Verifica tu contraseña maestra.',
    retryable: true,
  },
  CRYPTO_NOT_INITIALIZED: {
    category: 'CRYPTO_ERROR',
    userMessage: 'Cifrado no configurado.',
    recommendedAction: 'Completa la configuración inicial.',
    retryable: false,
  },
  CRYPTO_LOCKED: {
    category: 'CRYPTO_ERROR',
    userMessage: 'Extensión bloqueada.',
    recommendedAction: 'Ingresa tu contraseña maestra para desbloquear.',
    retryable: false,
  },
  CRYPTO_DECRYPT_FAILED: {
    category: 'CRYPTO_ERROR',
    userMessage: 'No se pudo descifrar la credencial.',
    recommendedAction: 'Edita la cuenta para volver a ingresarla.',
    retryable: false,
  },
  CRYPTO_ENCRYPT_FAILED: {
    category: 'CRYPTO_ERROR',
    userMessage: 'No se pudo cifrar la credencial.',
    recommendedAction: 'Intenta de nuevo.',
    retryable: true,
  },
  SCHEDULER_TASK_NOT_FOUND: {
    category: 'SCHEDULER_ERROR',
    userMessage: 'Programación no encontrada.',
    recommendedAction: 'La tarea puede haber sido cancelada.',
    retryable: false,
  },
  SCHEDULER_INVALID_TRIGGER: {
    category: 'SCHEDULER_ERROR',
    userMessage: 'Configuración de programación inválida.',
    recommendedAction: 'Verifica los valores ingresados.',
    retryable: false,
  },
  VALIDATION_FAILED: {
    category: 'VALIDATION_ERROR',
    userMessage: 'Datos inválidos.',
    recommendedAction: 'Revisa los campos marcados en rojo.',
    retryable: false,
  },
  BACKUP_CHECKSUM_MISMATCH: {
    category: 'STORAGE_ERROR',
    userMessage: 'El archivo de backup está corrupto o fue modificado.',
    recommendedAction: 'Verifica que el archivo no fue alterado.',
    retryable: false,
  },
  BACKUP_INVALID_FORMAT: {
    category: 'VALIDATION_ERROR',
    userMessage: 'El archivo no es un backup válido de NEXA NautaX.',
    recommendedAction: 'Asegúrate de importar un archivo exportado por NEXA NautaX ELITE.',
    retryable: false,
  },
  UNKNOWN_ERROR: {
    category: 'UNKNOWN_ERROR',
    userMessage: 'Ocurrió un error inesperado.',
    recommendedAction: 'Intenta de nuevo. Si persiste, revisa Developer Mode.',
    retryable: true,
  },
};

// —— Factory ————————————————————————————————————————————————

export function makeError(
  code: NexaErrorCode,
  technicalMessage: string,
  options?: { cause?: unknown; traceId?: string },
): NexaError {
  const catalog = ERROR_CATALOG[code];
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

export function toNexaError(unknown: unknown, traceId?: string): NexaError {
  if (unknown instanceof Error) {
    return makeError('UNKNOWN_ERROR', unknown.message, {
      cause: unknown,
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  return makeError(
    'UNKNOWN_ERROR',
    String(unknown),
    traceId !== undefined ? { traceId } : undefined,
  );
}
