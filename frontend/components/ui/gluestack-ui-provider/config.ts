import { Uniwind } from 'uniwind';

export type ModeType = 'light' | 'dark' | 'system';

// Maps our theme mode to the UniWind theme name
export const config = {
  light: 'light' as const,
  dark: 'dark' as const,
};

// Apply a theme mode via UniWind
export function applyMode(mode: ModeType) {
  if (mode === 'system') {
    Uniwind.setTheme('system');
  } else {
    Uniwind.setTheme(mode);
  }
}
