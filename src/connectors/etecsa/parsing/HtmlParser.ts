/**
 * NEXA NautaX — HtmlParser
 *  — Doc 2 §5
 *
 * Delega al OffscreenBridge para parsear HTML (el SW no tiene DOMParser).
 * Expone una API de alto nivel para cada tipo de parseo.
 */

import type {
  LoginFormFields,
  ParsedData,
  SessionInfoFields,
} from '../contracts/types';
import type { AttributeUuid, CsrfToken, WlanUserIp } from '@/types/branded';
import {
  asAttributeUuid,
  asCsrfToken,
  asWlanUserIp,
} from '@/types/branded';
import type { Result } from '@/modules/result/Result';
import { err, ok } from '@/modules/result/Result';
import type { EtecsaError } from '../contracts/types';
import { makeEtecsaError } from '../errors/EtecsaError';
import { getOffscreenBridge } from './OffscreenBridge';

export class HtmlParser {
  /**
   * Extrae los campos hidden del form de login inicial.
   */
  async extractLoginForm(html: string): Promise<Result<LoginFormFields, EtecsaError>> {
    const result = await getOffscreenBridge().parse({
      type: 'PARSE_LOGIN_FORM',
      html,
    });

    if (!result.ok) return result;

    const data = result.value;
    if (data.kind !== 'loginForm') {
      return err(makeEtecsaError('CONNECTOR_PARSER_FAILED', 'Unexpected parsed kind'));
    }

    return ok(data.fields);
  }

  /**
   * Extrae ATTRIBUTE_UUID de la respuesta de login.
   */
  async extractAttributeUuid(html: string): Promise<Result<AttributeUuid, EtecsaError>> {
    const result = await getOffscreenBridge().parse({
      type: 'EXTRACT_ATTRIBUTE_UUID',
      html,
    });

    if (!result.ok) return result;

    const data = result.value;
    if (data.kind !== 'attributeUuid') {
      return err(makeEtecsaError('CONNECTOR_PARSER_FAILED', 'Unexpected parsed kind'));
    }

    return ok(data.uuid);
  }

  /**
   * Extrae mensaje de alert() si existe en el HTML.
   * Retorna null si no hay alert.
   */
  async extractAlertMessage(html: string): Promise<Result<string | null, EtecsaError>> {
    const result = await getOffscreenBridge().parse({
      type: 'EXTRACT_ALERT_MESSAGE',
      html,
    });

    if (!result.ok) return result;

    const data = result.value;
    if (data.kind !== 'alertMessage') {
      return err(makeEtecsaError('CONNECTOR_PARSER_FAILED', 'Unexpected parsed kind'));
    }

    return ok(data.message);
  }

  /**
   * Extrae información de sesión (saldo, expiración) del HTML.
   */
  async extractSessionInfo(html: string): Promise<Result<SessionInfoFields, EtecsaError>> {
    const result = await getOffscreenBridge().parse({
      type: 'EXTRACT_SESSION_INFO',
      html,
    });

    if (!result.ok) return result;

    const data = result.value;
    if (data.kind !== 'sessionInfo') {
      return err(makeEtecsaError('CONNECTOR_PARSER_FAILED', 'Unexpected parsed kind'));
    }

    return ok(data.fields);
  }
}

// ═══ Helpers de validación (usados por offscreen.ts también) ════════

export function isValidCsrfToken(s: string): s is CsrfToken {
  return /^[a-f0-9]{32}$/i.test(s);
}

export function isValidAttributeUuid(s: string): s is AttributeUuid {
  return /^[a-zA-Z0-9]{16,128}$/.test(s);
}

export function isValidWlanUserIp(s: string): s is WlanUserIp {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s);
}

export function asValidCsrfToken(s: string): CsrfToken {
  return asCsrfToken(s);
}

export function asValidAttributeUuid(s: string): AttributeUuid {
  return asAttributeUuid(s);
}

export function asValidWlanUserIp(s: string): WlanUserIp {
  return asWlanUserIp(s);
}

// Tipo guard para ParsedData kind
export function isParsedData<T extends ParsedData['kind']>(
  data: ParsedData,
  kind: T,
): data is Extract<ParsedData, { kind: T }> {
  return data.kind === kind;
}
