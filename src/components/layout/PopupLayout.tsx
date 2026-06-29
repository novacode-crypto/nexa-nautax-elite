/**
 * NEXA NautaX — PopupLayout — Debug v5
 *
 * Cambios v5:
 * - overflow: hidden en el contenedor (no visible — eso rompía la altura)
 * - Header y footer con z-index alto
 * - Content con overflow-y auto y overflow-x hidden (los dropdowns via portal no se cortan)
 * - Sin espacio blanco debajo del footer
 */

import { type ReactNode } from 'react';
import { NexaLogo } from '@/components/nexa/NexaLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { StatusPill } from '@/components/nexa/StatusPill';
import type { ConnectionStatus } from '@/components/nexa/NexaStatusIndicator';
import { cn } from '@/utils/cn';

export interface PopupLayoutProps {
  readonly children: ReactNode;
  readonly status: ConnectionStatus;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function PopupLayout({ children, status, header, footer, className }: PopupLayoutProps) {
  return (
    <div
      className="flex flex-col text-foreground relative"
      style={{
        width: 'var(--popup-width)',
        height: 'var(--popup-height)',
        background: 'var(--background-gradient)',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blur orbs */}
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'var(--accent)', filter: 'blur(80px)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'var(--accent)', filter: 'blur(80px)' }}
      />

      {/* Header con glass */}
      <header
        className="relative flex items-center justify-between px-4 border-b border-border-subtle backdrop-blur-xl flex-shrink-0 z-30"
        style={{
          height: 'var(--popup-header-height)',
          backgroundColor: 'var(--background-glass)',
        }}
      >
        {header ?? (
          <>
            <NexaLogo size="sm" elite />
            <div className="flex items-center gap-2">
              <StatusPill status={status} />
              <ThemeToggle />
            </div>
          </>
        )}
      </header>

      {/* Content — sin scroll (overflow hidden). El contenido debe caber. */}
      <main
        className={cn('relative flex-1 px-4 py-3 min-w-0 overflow-hidden', className)}
      >
        {children}
      </main>

      {/* Footer con glass */}
      {footer && (
        <footer
          className="relative flex items-center px-4 border-t border-border-subtle text-xs text-foreground-muted backdrop-blur-xl flex-shrink-0 z-30"
          style={{
            height: 'var(--popup-footer-height)',
            backgroundColor: 'var(--background-glass)',
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
