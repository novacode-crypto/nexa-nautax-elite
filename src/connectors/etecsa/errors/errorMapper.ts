/**
 * NEXA NautaX — ETECSA Error Mapper
 *
 * Funciones de conveniencia para mapear respuestas HTML de ETECSA a errores.
 */

import type { EtecsaError, EtecsaErrorCode } from '../contracts/types';
import { makeEtecsaError } from './EtecsaError';
import { findErrorByMessage } from './errorCatalog';

/**
 * Mapea un mensaje de alerta extraído del HTML de ETECSA a un EtecsaError.
 * Si no hay matcheo, retorna AUTH_UNKNOWN_FAILURE con el mensaje original.
 */
export function mapAlertToError(
  alertMessage: string,
  traceId?: string,
): EtecsaError {
  const code = findErrorByMessage(alertMessage);
  if (code !== null) {
    return makeEtecsaError(code, `Alert matched: ${alertMessage}`, {
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  return makeEtecsaError(
    'AUTH_UNKNOWN_FAILURE',
    `Unrecognized ETECSA alert: ${alertMessage}`,
    { ...(traceId !== undefined ? { traceId } : {}) },
  );
}

/**
 * Construye un error de red tipado.
 */
export function mapNetworkError(
  error: unknown,
  traceId?: string,
): EtecsaError {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('timeout') || msg.includes('aborted')) {
    return makeEtecsaError('NETWORK_TIMEOUT', msg, {
      cause: error,
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  if (msg.includes('dns') || msg.includes('resolve') || msg.includes('ENOTFOUND')) {
    return makeEtecsaError('NETWORK_DNS', msg, {
      cause: error,
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  if (msg.includes('offline') || msg.includes('network')) {
    return makeEtecsaError('NETWORK_OFFLINE', msg, {
      cause: error,
      ...(traceId !== undefined ? { traceId } : {}),
    });
  }
  return makeEtecsaError('PORTAL_UNREACHABLE', msg, {
    cause: error,
    ...(traceId !== undefined ? { traceId } : {}),
  });
}

/**
 * Construye un error de parser tipado.
 */
export function makeParserError(
  reason: string,
  traceId?: string,
): EtecsaError {
  return makeEtecsaError('CONNECTOR_PARSER_FAILED', reason, {
    ...(traceId !== undefined ? { traceId } : {}),
  });
}

/**
 * Construye un error específico por código.
 */
export function makeError(
  code: EtecsaErrorCode,
  technicalMessage: string,
  options?: { cause?: unknown; traceId?: string },
): EtecsaError {
  return makeEtecsaError(code, technicalMessage, options);
}
