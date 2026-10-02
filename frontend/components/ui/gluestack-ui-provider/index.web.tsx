'use client';
import React, { useEffect, useLayoutEffect } from 'react';
import { Uniwind } from 'uniwind';
import { script } from './script';

export type ModeType = 'light' | 'dark' | 'system';

export const useSafeLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function GluestackUIProvider({
  mode = 'light',
  children,
}: {
  mode?: ModeType;
  children?: React.ReactNode;
}) {
  useSafeLayoutEffect(() => {
    if (mode === 'system') {
      Uniwind.setTheme('system');
    } else {
      Uniwind.setTheme(mode);
    }
    // Also apply class to <html> for CSS variable selectors
    if (typeof document !== 'undefined') {
      const el = document.documentElement;
      if (mode !== 'system') {
        el.classList.add(mode);
        el.classList.remove(mode === 'light' ? 'dark' : 'light');
        el.style.colorScheme = mode;
      }
    }
  }, [mode]);

  useSafeLayoutEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      script(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [mode]);

  return <>{children}</>;
}
