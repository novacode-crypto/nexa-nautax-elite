/**
 * NEXA NautaX — ThemeProvider — v4
 * Tema oscuro aplicado inmediatamente al montar.
 */

import { type ReactNode, useEffect } from 'react';
import type { ThemeName } from '@/types/theme';
import { useSettingsStore } from '@/store/settingsStore';

interface ThemeProviderProps {
  readonly children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'oscuro');
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const applyTheme = (theme: ThemeName) => {
      document.documentElement.setAttribute('data-theme', theme);
    };
    if (settings.theme.mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'oscuro' : 'claro');
      const h = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'oscuro' : 'claro');
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    }
    applyTheme(settings.theme.theme);
    return undefined;
  }, [settings.theme, hydrated]);

  return <>{children}</>;
}
