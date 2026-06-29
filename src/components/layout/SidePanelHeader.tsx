/**
 * NEXA NautaX — SidePanelHeader — Premium edition
 *
 * Glass effect, logo con gradient text, status pill con icono wifi.
 */

import { NexaLogo } from '@/components/nexa/NexaLogo';
import { ThemeToggle } from './ThemeToggle';
import { StatusPill } from '@/components/nexa/StatusPill';

export function SidePanelHeader() {
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
        <StatusPill status="disconnected" size="md" />
        <ThemeToggle />
      </div>
    </header>
  );
}
