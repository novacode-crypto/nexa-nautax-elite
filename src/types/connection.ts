/**
 * NEXA NautaX — Connection types
 * Fase 4 — Doc 1 §12
 */

export type ConnectionState =
  | 'ONLINE'
  | 'CAPTIVE_PORTAL'
  | 'CONNECTING'
  | 'AUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'OFFLINE'
  | 'ERROR';

export interface ConnectionSnapshot {
  readonly state: ConnectionState;
  readonly lastChecked: number;
  readonly lastTransition: number;
  readonly previousState: ConnectionState;
}

// —— Mapping a estados de UI ——————————————————————————————————

export type SessionStatusKind =
  | 'offline'
  | 'captive_portal'
  | 'connecting'
  | 'authenticated'
  | 'session_expired'
  | 'error';

export function mapConnectionStateToSessionStatus(state: ConnectionState): SessionStatusKind {
  switch (state) {
    case 'ONLINE':
      return 'offline'; // hay internet pero no sesión ETECSA
    case 'CAPTIVE_PORTAL':
      return 'captive_portal';
    case 'CONNECTING':
      return 'connecting';
    case 'AUTHENTICATED':
      return 'authenticated';
    case 'SESSION_EXPIRED':
      return 'session_expired';
    case 'OFFLINE':
      return 'offline';
    case 'ERROR':
      return 'error';
  }
}
