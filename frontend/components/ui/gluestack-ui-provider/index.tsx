import React, { useEffect } from 'react';
import { View, ViewProps } from 'react-native';
import { Uniwind } from 'uniwind';
import {
  useGluestackColors as useGluestackColorsHook,
  useCalendarTheme as useCalendarThemeHook,
} from './useGluestackColors';

export type ModeType = 'light' | 'dark' | 'system';

// Re-export color hooks
export const useGluestackColors = useGluestackColorsHook;
export const useCalendarTheme = useCalendarThemeHook;
export type { GluestackColors } from './useGluestackColors';

export function GluestackUIProvider({
  mode = 'light',
  children,
  style,
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  useEffect(() => {
    if (mode === 'system') {
      Uniwind.setTheme('system');
    } else {
      Uniwind.setTheme(mode);
    }
  }, [mode]);

  return (
    <View style={[{ flex: 1, height: '100%', width: '100%' }, style]}>
      {children}
    </View>
  );
}
