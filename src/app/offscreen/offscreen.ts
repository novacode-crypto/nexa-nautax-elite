/**
 * NEXA NautaX — Offscreen document
 *  — F2-D2
 *
 * Documento oculto con acceso al DOM. Recibe HTML desde el SW via
 * chrome.runtime.sendMessage y lo parsea con DOMParser.
 *
 * Tipos de parseo soportados:
 *  - PARSE_LOGIN_FORM: extrae CSRFHW, wlanuserip, loggerId, action del form#formulario
 *  - EXTRACT_ATTRIBUTE_UUID: busca ATTRIBUTE_UUID en scripts y HTML
 *  - EXTRACT_ALERT_MESSAGE: busca alert("...") en el HTML
 *  - EXTRACT_SESSION_INFO: busca saldo/expiresAt en #sessioninfo
 */

import type {
  OffscreenRequest,
  OffscreenResponse,
  ParsedData,
} from '@/connectors/etecsa/contracts/types';
import {
  asAttributeUuid,
  asCsrfToken,
  asWlanUserIp,
} from '@/types/branded';

// —— Listener de mensajes desde el SW ————————————————————————————

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  const msg = message as { type: string; payload?: OffscreenRequest | { priority: string } };

  // —— PLAY_BEEP: reproducir sonido de notificación ——
  if (msg.type === 'PLAY_BEEP') {
    playBeep((msg.payload as { priority: string })?.priority ?? 'normal');
    sendResponse({ ok: true });
    return false;
  }

  // —— OFFSCREEN_PARSE: parseo de HTML ——
  if (msg.type !== 'OFFSCREEN_PARSE') {
    return false;
  }

  const payload = msg.payload as OffscreenRequest;
  if (!payload) {
    sendResponse({
      ok: false,
      error: 'Missing payload in OFFSCREEN_PARSE message',
    } satisfies OffscreenResponse);
    return false;
  }

  console.debug('[Offscreen] Parse request', payload.type);

  try {
    const data = parseRequest(payload);
    sendResponse({ ok: true, data } satisfies OffscreenResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Offscreen] Parse failed', message);
    sendResponse({ ok: false, error: message } satisfies OffscreenResponse);
  }

  return true; // async response
});

// —— Parseo ————————————————————————————————————————————————————————

function parseRequest(req: OffscreenRequest): ParsedData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(req.html, 'text/html');

  switch (req.type) {
    case 'PARSE_LOGIN_FORM':
      return parseLoginForm(doc);

    case 'EXTRACT_ATTRIBUTE_UUID':
      return extractAttributeUuid(doc, req.html);

    case 'EXTRACT_ALERT_MESSAGE':
      return extractAlertMessage(doc, req.html);

    case 'EXTRACT_SESSION_INFO':
      return extractSessionInfo(doc, req.html);

    default: {
      // Exhaustiveness check — req.type should be never here
      const exhaustive = req;
      throw new Error(`Unknown parse type: ${String(exhaustive)}`);
    }
  }
}

// —— PARSE_LOGIN_FORM ————————————————————————————————————————————

function parseLoginForm(doc: Document): ParsedData {
  // Buscar form#formulario (selector primario)
  let form = doc.querySelector('form#formulario');
  if (!form) {
    // Fallback: cualquier form con input[type=password]
    form = doc.querySelector('form:has(input[type="password"])');
  }

  if (!form) {
    throw new Error('No login form found');
  }

  // Extraer action (URL de submit)
  const action = form.getAttribute('action') ?? '//LoginServlet';

  // Cosechar todos los inputs hidden
  const getHidden = (name: string): string => {
    const input = form!.querySelector(`input[name="${name}"]`);
    return input?.getAttribute('value') ?? '';
  };

  const csrfToken = getHidden('CSRFHW');
  const wlanUserIp = getHidden('wlanuserip');
  const loggerId = getHidden('loggerId');
  const gotopage = getHidden('gotopage') ?? '/';
  const successpage = getHidden('successpage') ?? '';
  const lang = getHidden('lang') ?? 'es';

  if (!csrfToken || csrfToken.length !== 32) {
    throw new Error(`CSRFHW missing or invalid: "${csrfToken}"`);
  }
  if (!wlanUserIp || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(wlanUserIp)) {
    throw new Error(`wlanuserip missing or invalid: "${wlanUserIp}"`);
  }
  if (!loggerId) {
    throw new Error('loggerId missing');
  }

  return {
    kind: 'loginForm',
    fields: {
      csrfToken: asCsrfToken(csrfToken),
      wlanUserIp: asWlanUserIp(wlanUserIp),
      loggerId,
      gotopage,
      successpage,
      lang,
      action,
    },
  };
}

// —— EXTRACT_ATTRIBUTE_UUID ——————————————————————————————————————

function extractAttributeUuid(doc: Document, rawHtml: string): ParsedData {
  // Pattern 1: ATTRIBUTE_UUID=xxx&CSRFHW= (en <script> o HTML)
  const patterns: RegExp[] = [
    /ATTRIBUTE_UUID=(\w+)&CSRFHW=/,
    /attribute_uuid=([a-f0-9]+)/i,
    /window\.__SESSION__\s*=\s*['"](\w+)['"]/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(rawHtml);
    if (match && match[1]) {
      return { kind: 'attributeUuid', uuid: asAttributeUuid(match[1]) };
    }
  }

  // Buscar en scripts inline
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = /ATTRIBUTE_UUID=([a-zA-Z0-9]+)/.exec(text);
    if (match && match[1]) {
      return { kind: 'attributeUuid', uuid: asAttributeUuid(match[1]) };
    }
  }

  throw new Error('ATTRIBUTE_UUID not found in response');
}

// —— EXTRACT_ALERT_MESSAGE ————————————————————————————————————————

function extractAlertMessage(doc: Document, rawHtml: string): ParsedData {
  // Pattern 1: <script>alert("...")</script>
  const patterns: RegExp[] = [
    /<script[^>]*>\s*alert\(["']([\w\s().,\u00C0-\u017F]+)["']\)\s*;?\s*<\/script>/giu,
    /alert\(["']([\w\s().,\u00C0-\u017F]+)["']\)/u,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(rawHtml);
    if (match && match[1]) {
      return { kind: 'alertMessage', message: match[1].trim() };
    }
  }

  // Buscar en scripts inline
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = /alert\(["']([\w\s().,\u00C0-\u017F]+)["']\)/u.exec(text);
    if (match && match[1]) {
      return { kind: 'alertMessage', message: match[1].trim() };
    }
  }

  // Sin alert
  return { kind: 'alertMessage', message: null };
}

// —— EXTRACT_SESSION_INFO ——————————————————————————————————————————

function extractSessionInfo(doc: Document, _rawHtml: string): ParsedData {
  // Buscar #sessioninfo o .session-info
  let container = doc.querySelector('#sessioninfo');
  if (!container) container = doc.querySelector('.session-info');
  if (!container) container = doc.querySelector('.balance-info');

  if (!container) {
    throw new Error('Session info container not found');
  }

  const text = container.textContent ?? '';

  // Extraer saldo: "Saldo: 25.50 CUP" o "$25.50"
  let balance: number | undefined;
  const balanceMatch = /(?:saldo|balance)[:\s]*\$?([\d,.]+)\s*(?:cup)?/i.exec(text);
  if (balanceMatch && balanceMatch[1]) {
    balance = parseFloat(balanceMatch[1].replace(',', '.'));
  }

  // Extraer expiración: "Bloqueo: 30/06/2026" o "Expira: ..."
  let expiresAt: number | undefined;
  const expiresMatch = /(?:bloqueo|expira|expiraci[oó]n)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.exec(text);
  if (expiresMatch && expiresMatch[1]) {
    const date = parseDate(expiresMatch[1]);
    if (date) expiresAt = date.getTime();
  }

  return {
    kind: 'sessionInfo',
    fields: {
      currency: 'CUP',
      ...(balance !== undefined ? { balance } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    },
  };
}

// —— Helpers ————————————————————————————————————————————————————

function parseDate(s: string): Date | null {
  // Formatos comunes: DD/MM/YYYY, DD-MM-YYYY
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (!match) return null;
  const day = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10) - 1;
  let year = parseInt(match[3]!, 10);
  if (year < 100) year += 2000;
  return new Date(year, month, day);
}

// —— Init log ————————————————————————————————————————————————————

console.log('[NEXA NautaX Offscreen] Document ready', {
  hasDOMParser: typeof DOMParser !== 'undefined',
});

// —— Beep: reproducir sonido de notificación ——————————————————————

function playBeep(priority: string): void {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Frecuencia según prioridad
    const freqs: Record<string, number> = {
      low: 440,
      normal: 523,    // C5
      high: 659,      // E5
      critical: 880,  // A5
    };
    const freq = freqs[priority] ?? 523;

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    // Envelope: attack + decay rápido
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);

    // Segundo beep para critical
    if (priority === 'critical') {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.value = freq * 1.5;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0, audioCtx.currentTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.45);
    }
  } catch (e) {
    console.warn('[Offscreen] Beep failed', e);
  }
}
