/**
 * NEXA NautaX — SidePanelLayout — Debug v4
 *
 * Cambios v4:
 * - nav con z-index alto para tooltips encima del content
 * - overflow visible en main para tooltips no se corten
 */

import { type ReactNode } from 'react';
import { SidePanelHeader } from './SidePanelHeader';
import { SidePanelNav } from './SidePanelNav';
import { SidePanelFooter } from './SidePanelFooter';

export interface SidePanelLayoutProps {
  readonly children: ReactNode;
}

export function SidePanelLayout({ children }: SidePanelLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden min-w-0">
      <SidePanelHeader />

      <div className="flex flex-1 overflow-hidden min-w-0 relative">
        {/* Nav con z-index alto para que sus tooltips aparezcan encima del content */}
        <div className="relative z-40 flex-shrink-0">
          <SidePanelNav />
        </div>
        {/* Content con overflow visible para que los tooltips no se corten */}
        <main
          className="flex-1 p-4 min-w-0"
          style={{
            overflowY: 'auto',
            overflowX: 'visible',
            scrollbarWidth: 'thin',
          }}
        >
          {children}
        </main>
      </div>

      <SidePanelFooter />
    </div>
  );
}
