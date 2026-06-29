/**
 * NEXA NautaX — useDashboardData
 *
 * Hook para la sección 1 del dashboard:
 *  - Estado de la sesión activa (lee de chrome.storage y reacciona a cambios)
 *  - Estado del portal ETECSA (probe)
 *
 * Se suscribe a chrome.storage.onChanged para detectar cuando la sesión
 * cambia desde el popup (login/logout) sin necesidad de refrescar manualmente.
 */

import { useState, useEffect, useCallback } from 'react';
import { messageClient, type SessionSummary } from '@/modules/messaging/messageClient';
import { STORAGE_KEYS } from '@/storage/namespaces';

export type PortalStatus = 'ONLINE' | 'CAPTIVE_PORTAL' | 'OFFLINE' | 'UNKNOWN';

export interface DashboardSection1Data {
  /** Sesión activa (null si no hay) */
  readonly session: SessionSummary | null;
  /** Estado del portal ETECSA */
  readonly portalStatus: PortalStatus;
  /** True mientras se está cargando la sesión inicial */
  readonly loadingSession: boolean;
  /** True mientras se está probing el portal */
  readonly loadingPortal: boolean;
  /** Refresca el estado del portal manualmente */
  readonly refreshPortal: () => Promise<void>;
  /** Error al probe (si hubo) */
  readonly portalError: string | null;
}

export function useDashboardData(): DashboardSection1Data {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [portalStatus, setPortalStatus] = useState<PortalStatus>('UNKNOWN');
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // —— Cargar sesión inicial ——
  const loadSession = useCallback(async () => {
    const r = await messageClient.sessionGetState();
    if (r.ok) {
      setSession(r.data);
    }
    setLoadingSession(false);
  }, []);

  // —— Probe del portal ——
  const refreshPortal = useCallback(async () => {
    setLoadingPortal(true);
    setPortalError(null);
    try {
      const r = await messageClient.connectionProbe();
      if (r.ok && r.data) {
        setPortalStatus(r.data.state as PortalStatus);
      } else {
        setPortalStatus('UNKNOWN');
        setPortalError(r.ok ? null : r.error.userMessage);
      }
    } catch {
      setPortalStatus('UNKNOWN');
      setPortalError('No se pudo verificar el estado del portal');
    } finally {
      setLoadingPortal(false);
    }
  }, []);

  // —— Init: cargar sesión + probe ——
  useEffect(() => {
    void loadSession();
    void refreshPortal();
  }, [loadSession, refreshPortal]);

  // —— Suscripción a cambios en chrome.storage.local ——
  // Detecta cuando la sesión cambia desde el popup
  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      // Cambio en sesión activa
      if (STORAGE_KEYS.SESSION_ACTIVE in changes) {
        const change = changes[STORAGE_KEYS.SESSION_ACTIVE];
        if (change?.newValue) {
          // Nueva sesión creada
          const s = change.newValue as SessionSummary;
          setSession(s);
        } else if (change?.oldValue && !change.newValue) {
          // Sesión cerrada
          setSession(null);
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // —— Auto-refresh del portal cada 30s ——
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshPortal();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshPortal]);

  return {
    session,
    portalStatus,
    loadingSession,
    loadingPortal,
    refreshPortal,
    portalError,
  };
}
