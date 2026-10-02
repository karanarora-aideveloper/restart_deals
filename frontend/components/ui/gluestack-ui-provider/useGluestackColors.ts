import { useColorScheme } from 'react-native';

// Color definitions matching global.css tokens
const colors = {
  light: {
    '--primary': '255 107 0',
    '--primary-foreground': '255 255 255',
    '--card': '255 255 255',
    '--secondary': '245 245 245',
    '--secondary-foreground': '23 23 23',
    '--background': '255 255 255',
    '--popover': '255 255 255',
    '--popover-foreground': '10 10 10',
    '--muted': '245 245 245',
    '--muted-foreground': '115 115 115',
    '--destructive': '231 0 11',
    '--foreground': '10 10 10',
    '--border': '229 229 229',
    '--input': '229 229 229',
    '--ring': '255 107 0',
    '--accent': '247 247 247',
    '--accent-foreground': '52 52 52',
  },
  dark: {
    '--primary': '255 107 0',
    '--primary-foreground': '23 23 23',
    '--card': '23 23 23',
    '--secondary': '38 38 38',
    '--secondary-foreground': '250 250 250',
    '--background': '10 10 10',
    '--popover': '23 23 23',
    '--popover-foreground': '250 250 250',
    '--muted': '38 38 38',
    '--muted-foreground': '161 161 161',
    '--destructive': '255 100 103',
    '--foreground': '250 250 250',
    '--border': '46 46 46',
    '--input': '46 46 46',
    '--ring': '255 107 0',
    '--accent': '38 38 38',
    '--accent-foreground': '250 250 250',
  },
};

/**
 * Convert CSS variable name to camelCase
 * Example: '--primary-foreground' -> 'primaryForeground'
 */
function toCamelCase(str: string): string {
  return str
    .replace(/^--/, '') // Remove leading --
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); // Convert -x to X
}

/**
 * Convert RGB string "23 23 23" to hex "#171717"
 */
function rgbToHex(rgbString: string): string {
  const parts = rgbString.trim().split(/\s+/);
  if (parts.length !== 3) return '#000000';

  const [r, g, b] = parts.map((s) => {
    const num = parseInt(s, 10);
    return isNaN(num) ? 0 : num;
  });

  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Hook to get all gluestack colors as hex values
 */
export function useGluestackColors(): Record<string, string> {
  const colorScheme = useColorScheme();
  const theme = colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const result: Record<string, string> = {};
  Object.entries(theme).forEach(([key, value]) => {
    const camelKey = toCamelCase(key);
    result[camelKey] = rgbToHex(value as string);
  });

  return result;
}

/**
 * Hook to get calendar theme object for react-native-calendars
 */
export function useCalendarTheme(): Record<string, string> {
  const palette = useGluestackColors();

  return {
    backgroundColor: palette.background || '#ffffff',
    calendarBackground: palette.background || '#ffffff',
    textSectionTitleColor: palette.mutedForeground || '#737373',
    selectedDayBackgroundColor: palette.primary || '#ff6b00',
    selectedDayTextColor: palette.primaryForeground || '#ffffff',
    todayTextColor: palette.primary || '#ff6b00',
    todayBackgroundColor: palette.accent || '#f7f7f7',
    dayTextColor: palette.foreground || '#0a0a0a',
    textDisabledColor: palette.mutedForeground || '#737373',
    dotColor: palette.primary || '#ff6b00',
    selectedDotColor: palette.primaryForeground || '#ffffff',
    arrowColor: palette.foreground || '#0a0a0a',
    monthTextColor: palette.foreground || '#0a0a0a',
    indicatorColor: palette.primary || '#ff6b00',
  };
}

// Type helper
export type GluestackColors = ReturnType<typeof useGluestackColors>;
