/**
 * NEXA NautaX — Theme types
 *  — Doc 1
 *
 * Nombres en español según preferencia del usuario.
 */

export type ThemeName = 'oscuro' | 'claro' | 'nebula' | 'aurora';

export type ThemeMode = 'manual' | 'system';

export interface ThemeSetting {
  readonly mode: ThemeMode;
  readonly theme: ThemeName;
}

export interface Theme {
  readonly name: ThemeName;
  readonly label: string;
  readonly description: string;
  readonly preview: { primary: string; background: string; accent: string };
}

export const AVAILABLE_THEMES: readonly Theme[] = [
  {
    name: 'oscuro',
    label: 'Oscuro',
    description: 'Tema oscuro premium estilo Linear.',
    preview: { primary: '#8b5cf6', background: '#09090b', accent: '#a78bfa' },
  },
  {
    name: 'claro',
    label: 'Claro',
    description: 'Tema claro limpio estilo Apple.',
    preview: { primary: '#7c3aed', background: '#fafafa', accent: '#6d28d9' },
  },
  {
    name: 'aurora',
    label: 'Aurora',
    description: 'Amanecer nórdico: coral + menta sobre blanco perla.',
    preview: { primary: '#e97451', background: '#fbf9f6', accent: '#4fb286' },
  },
  {
    name: 'nebula',
    label: 'Nebula',
    description: 'Magenta + cyan sobre deep purple vibrante.',
    preview: { primary: '#ec4899', background: '#0f0820', accent: '#00bbf9' },
  },
];
