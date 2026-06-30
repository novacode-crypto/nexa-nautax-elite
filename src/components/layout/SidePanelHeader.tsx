/**
 * NEXA NautaX — SidePanelHeader
 *
 * Glass effect, logo con gradient text, status pill reactivo al estado de sesión.
 */

import { useState, useEffect } from 'react';
import { NexaLogo } from '@/components/nexa/NexaLogo';
import { ThemeToggle } from './ThemeToggle';
import { StatusPill } from '@/components/nexa/StatusPill';
import type { ConnectionStatus } from '@/components/nexa/NexaStatusIndicator';
import { messageClient } from '@/modules/messaging/messageClient';
import { STORAGE_KEYS } from '@/storage/namespaces';

export function SidePanelHeader() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const checkSession = async () => {
      const r = await messageClient.sessionGetState();
      if (r.ok && r.data) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    };
    void checkSession();

    // Escuchar cambios en la sesión activa
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.SESSION_ACTIVE in changes) {
        const change = changes[STORAGE_KEYS.SESSION_ACTIVE];
        if (change?.newValue) {
          setStatus('connected');
        } else if (change?.oldValue && !change.newValue) {
          setStatus('disconnected');
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 border-b border-border-subtle backdrop-blur-xl"
      style={{
        height: 'var(--sidepanel-header-height)',
        backgroundColor: 'var(--background-glass)',
      }}
    >
      <NexaLogo size="sm" elite />
      <div className="flex items-center gap-2">
        <StatusPill status={status} size="md" />
        <ThemeToggle />
      </div>
    </header>
  );
}
