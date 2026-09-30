import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Palette } from '@/theme/tokens';

const STORAGE_KEY = 'liftcamp:theme';

/** What the user picked. `auto` follows the system. */
export type ThemeSetting = 'light' | 'dark' | 'auto';

export const THEME_SETTINGS: ThemeSetting[] = ['light', 'dark', 'auto'];

type ThemeState = {
  /** The resolved scheme, after `auto` is applied. */
  scheme: ColorScheme;
  colors: Palette;
  setting: ThemeSetting;
  setSetting: (next: ThemeSetting) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return value;
}

/** Colors alone, which is what most components want. */
export function useColors(): Palette {
  return useTheme().colors;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Light on first launch, per the spec. The stored value replaces this once
  // it loads; the flash is one frame and only on a dark-mode device.
  const [setting, setSettingState] = useState<ThemeSetting>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        setSettingState(stored);
      }
    });
  }, []);

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const scheme: ColorScheme =
    setting === 'auto' ? (system === 'dark' ? 'dark' : 'light') : setting;

  const value = useMemo(
    () => ({ scheme, colors: palettes[scheme], setting, setSetting }),
    [scheme, setting, setSetting],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Forces a scheme for everything inside it, leaving the app's setting
 * alone. For dev screens that show one component in both themes.
 */
export function ThemeOverride({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  const parent = useTheme();
  const value = useMemo(() => ({ ...parent, scheme, colors: palettes[scheme] }), [parent, scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
