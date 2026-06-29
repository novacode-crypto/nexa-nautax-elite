/**
 * NEXA NautaX — OffscreenBridge
 *  — F2-D2
 *
 * El SW de MV3 no tiene DOMParser. Para parsear HTML de ETECSA,
 * delegamos al offscreen document via chrome.runtime.sendMessage.
 *
 * Este bridge es el único punto que sabe cómo hablar con el offscreen.
 */

import type {
  OffscreenRequest,
  OffscreenResponse,
  ParsedData,
} from '../contracts/types';
import type { Result } from '@/modules/result/Result';
import { err, ok } from '@/modules/result/Result';
import type { EtecsaError } from '../contracts/types';
import { makeEtecsaError } from '../errors/EtecsaError';

const OFFSCREEN_URL = 'src/app/offscreen/index.html';

export class OffscreenBridge {
  private hasOffscreen: boolean = false;

  /**
   * Asegura que el offscreen document existe.
   * Idempotente — si ya existe, no hace nada.
   */
  async ensureOffscreen(): Promise<void> {
    if (this.hasOffscreen) return;

    if (chrome.offscreen === undefined) {
      throw new Error('Offscreen API not available');
    }

    // Verificar si ya existe
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });

    if (existingContexts.length > 0) {
      this.hasOffscreen = true;
      return;
    }

    // Crear offscreen document
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
      justification: 'Parse HTML responses from ETECSA captive portal',
    });
    this.hasOffscreen = true;
    console.debug('[OffscreenBridge] Document created');
  }

  /**
   * Envía un request de parsing al offscreen document.
   */
  async parse(request: OffscreenRequest): Promise<Result<ParsedData, EtecsaError>> {
    try {
      await this.ensureOffscreen();
    } catch (error) {
      return err(
        makeEtecsaError('CONNECTOR_PARSER_FAILED', `Cannot create offscreen: ${String(error)}`),
      );
    }

    return new Promise((resolve) => {
      const message = { type: 'OFFSCREEN_PARSE', payload: request };

      chrome.runtime
        .sendMessage(message)
        .then((response: unknown) => {
          const parsed = response as OffscreenResponse | undefined;
          if (!parsed) {
            resolve(
              err(makeEtecsaError('CONNECTOR_PARSER_FAILED', 'No response from offscreen')),
            );
            return;
          }
          if (!parsed.ok) {
            resolve(
              err(makeEtecsaError('CONNECTOR_PARSER_FAILED', parsed.error)),
            );
            return;
          }
          resolve(ok(parsed.data));
        })
        .catch((error: unknown) => {
          resolve(
            err(
              makeEtecsaError(
                'CONNECTOR_PARSER_FAILED',
                `Offscreen communication error: ${String(error)}`,
              ),
            ),
          );
        });
    });
  }

  /**
   * Cierra el offscreen document (para liberar memoria cuando no se usa).
   */
  async closeOffscreen(): Promise<void> {
    if (!this.hasOffscreen) return;
    if (chrome.offscreen === undefined) return;

    try {
      await chrome.offscreen.closeDocument();
      this.hasOffscreen = false;
      console.debug('[OffscreenBridge] Document closed');
    } catch (error) {
      // Ignorar — probablemente ya estaba cerrado
      console.debug('[OffscreenBridge] closeDocument error (ignored)', error);
    }
  }
}

// Singleton
let bridgeInstance: OffscreenBridge | null = null;

export function getOffscreenBridge(): OffscreenBridge {
  if (bridgeInstance === null) {
    bridgeInstance = new OffscreenBridge();
  }
  return bridgeInstance;
}
