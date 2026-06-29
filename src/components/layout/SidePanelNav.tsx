/**
 * NEXA NautaX — SidePanelNav
 * Navegación del panel lateral con tooltips via portal.
 * Botón "Acerca de" pegado al footer (mt-auto).
 */

import { useRef, useState } from 'react';
import { LayoutDashboard, Users, Settings, Terminal, Info } from 'lucide-react';
import type { SidePanelView } from '@/store/uiStore';
import { useUiStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { TooltipPortal } from '@/components/nexa/TooltipPortal';

interface NavItem {
  readonly view: SidePanelView;
  readonly label: string;
  readonly Icon: typeof LayoutDashboard;
  readonly devOnly?: boolean;
  readonly pinnedBottom?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { view: 'accounts', label: 'Cuentas', Icon: Users },
  { view: 'settings', label: 'Ajustes', Icon: Settings },
  { view: 'developer', label: 'Developer', Icon: Terminal, devOnly: true },
  { view: 'about', label: 'Acerca de', Icon: Info, pinnedBottom: true },
];

interface NavButtonProps {
  readonly item: NavItem;
  readonly isActive: boolean;
  readonly onClick: () => void;
}

function NavButton({ item, isActive, onClick }: NavButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const { label, Icon } = item;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="group relative flex items-center justify-center mx-2 rounded-xl transition-all duration-200"
        style={{
          height: 40,
          width: 40,
          margin: '0 auto',
          backgroundImage: isActive ? 'var(--primary-gradient)' : 'none',
          color: isActive ? 'var(--primary-foreground)' : 'var(--foreground-muted)',
          boxShadow: isActive ? 'var(--glow-primary)' : 'none',
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
      >
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      </button>

      <TooltipPortal show={showTooltip} triggerRef={ref} position="right">
        {label}
      </TooltipPortal>
    </>
  );
}

export function SidePanelNav() {
  const currentView = useUiStore((s) => s.sidePanelView);
  const setView = useUiStore((s) => s.setSidePanelView);
  const devVisible = useSettingsStore((s) => s.settings.developer.visible);

  const visibleItems = NAV_ITEMS.filter((item) => !item.devOnly || devVisible);
  const topItems = visibleItems.filter((item) => !item.pinnedBottom);
  const bottomItems = visibleItems.filter((item) => item.pinnedBottom);

  return (
    <nav
      className="flex flex-col gap-1.5 border-r border-border-subtle py-4 backdrop-blur-sm h-full"
      style={{
        width: 'var(--sidepanel-nav-width)',
        backgroundColor: 'var(--background-glass)',
        overflow: 'visible',
        position: 'relative',
        zIndex: 50,
      }}
      aria-label="Navegación principal"
    >
      {/* Items superiores */}
      {topItems.map((item) => (
        <NavButton
          key={item.view}
          item={item}
          isActive={currentView === item.view}
          onClick={() => setView(item.view)}
        />
      ))}

      {/* Items pegados al footer */}
      <div className="mt-auto flex flex-col gap-1.5">
        {bottomItems.map((item) => (
          <NavButton
            key={item.view}
            item={item}
            isActive={currentView === item.view}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>
    </nav>
  );
}
