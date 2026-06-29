/**
 * NEXA NautaX — NotificationHelper (SW-side)
 *
 * Notificaciones que funcionan SIN popup abierto:
 * 1. Badge en el icono de la extensión (chrome.action.setBadgeText)
 * 2. Cambio de icono según estado (chrome.action.setIcon)
 * 3. Sonido beep via offscreen document
 */

type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

interface NotificationOptions {
  readonly title: string;
  readonly message?: string;
  readonly priority?: NotificationPriority;
  readonly sound?: boolean;
}

let badgeCount = 0;
let currentIconState: 'connected' | 'disconnected' | 'no-account' | 'error' = 'disconnected';

const ICON_PATHS: Record<string, Record<string, string>> = {
  connected: {
    '16': 'public/icons/icon-states/connected-16.png',
    '32': 'public/icons/icon-states/connected-32.png',
    '48': 'public/icons/icon-states/connected-48.png',
    '128': 'public/icons/icon-states/connected-128.png',
  },
  disconnected: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  'no-account': {
    '16': 'public/icons/icon-states/no-account-16.png',
    '32': 'public/icons/icon-states/no-account-32.png',
    '48': 'public/icons/icon-states/no-account-48.png',
    '128': 'public/icons/icon-states/no-account-128.png',
  },
  error: {
    '16': 'public/icons/icon-states/error-16.png',
    '32': 'public/icons/icon-states/error-32.png',
    '48': 'public/icons/icon-states/error-48.png',
    '128': 'public/icons/icon-states/error-128.png',
  },
};

const BADGE_COLORS: Record<NotificationPriority, string> = {
  low: '#71717a',
  normal: '#6366f1',
  high: '#f59e0b',
  critical: '#ef4444',
};

/**
 * Actualiza el icono de la extensión según el estado de conexión.
 */
export async function setIconState(state: typeof currentIconState): Promise<void> {
  if (state === currentIconState) return;
  currentIconState = state;
  try {
    await chrome.action.setIcon({ path: ICON_PATHS[state] ?? ICON_PATHS.disconnected });
  } catch {
    // Ignorar si los iconos no existen aún
  }
}

/**
 * Muestra una notificación visual (badge) + sonido.
 * Funciona SIN popup abierto.
 */
export async function notify(options: NotificationOptions): Promise<void> {
  const priority = options.priority ?? 'normal';

  // 1. Badge en el icono
  if (priority === 'high' || priority === 'critical') {
    badgeCount++;
    try {
      await chrome.action.setBadgeText({ text: String(badgeCount) });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[priority] });
    } catch {
      // Ignorar
    }
  }

  // 2. Sonido beep via offscreen
  if (options.sound !== false) {
    await playBeep(priority);
  }

  // 3. Log
  console.log('[Notification]', { title: options.title, message: options.message, priority });
}

/**
 * Limpia el badge del icono.
 */
export async function clearBadge(): Promise<void> {
  badgeCount = 0;
  try {
    await chrome.action.setBadgeText({ text: '' });
  } catch {
    // Ignorar
  }
}

/**
 * Reproduce un beep corto via offscreen document.
 * El offscreen document tiene un <audio> element que reproduce un tono generado.
 */
async function playBeep(priority: NotificationPriority): Promise<void> {
  try {
    // Asegurar que el offscreen document existe
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'src/app/offscreen/index.html',
        reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
        justification: 'Audio playback for notifications',
      });
    }

    // Enviar mensaje al offscreen para reproducir beep
    await chrome.runtime.sendMessage({
      type: 'PLAY_BEEP',
      payload: { priority },
    });
  } catch {
    // Si falla, no es crítico
  }
}
