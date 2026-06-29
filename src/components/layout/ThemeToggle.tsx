/**
 * NEXA NautaX — ThemeToggle — 
 *
 * Tooltip via portal (no se corta).
 */

import { useRef, useState } from 'react';
import { Sun, Moon, Sunrise, Sparkles } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import type { ThemeName } from '@/types/theme';
import { TooltipPortal } from '@/components/nexa/TooltipPortal';

const THEMES: Array<{ name: ThemeName; Icon: typeof Sun; label: string }> = [
  { name: 'oscuro', Icon: Moon, label: 'Oscuro' },
  { name: 'claro', Icon: Sun, label: 'Claro' },
  { name: 'aurora', Icon: Sunrise, label: 'Aurora' },
  { name: 'nebula', Icon: Sparkles, label: 'Nebula' },
];

export function ThemeToggle() {
  const currentTheme = useSettingsStore((s) => s.settings.theme.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const [showTooltip, setShowTooltip] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentIndex = THEMES.findIndex((t) => t.name === currentTheme);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + 1) % THEMES.length;
  const next = THEMES[nextIndex]!;
  const CurrentIcon = THEMES[safeIndex]?.Icon ?? Moon;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void setTheme(next.name)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="group flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: 'var(--muted)',
          border: '1px solid var(--border)',
          color: 'var(--foreground-muted)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.boxShadow = 'var(--glow-accent)';
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = 'var(--foreground-muted)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        aria-label={`Tema actual: ${THEMES[safeIndex]?.label}. Cambiar a ${next.label}`}
      >
        <CurrentIcon size={14} />
      </button>

      <TooltipPortal show={showTooltip} triggerRef={triggerRef} position="bottom">
        {`${THEMES[safeIndex]?.label} → ${next.label}`}
      </TooltipPortal>
    </>
  );
}

// —— Theme selector completo (para Settings) ————————————————————————

export function ThemeSelectorGrid() {
  const currentTheme = useSettingsStore((s) => s.settings.theme.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div className="grid grid-cols-4 gap-2">
      {THEMES.map(({ name, Icon, label }) => {
        const isActive = currentTheme === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => void setTheme(name)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: isActive ? 'var(--primary-gradient)' : 'var(--background-glass)',
              borderColor: isActive ? 'transparent' : 'var(--border)',
              boxShadow: isActive ? 'var(--glow-primary)' : 'var(--shadow-sm)',
              color: isActive ? 'var(--primary-foreground)' : 'var(--foreground-muted)',
            }}
          >
            <Icon size={18} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
