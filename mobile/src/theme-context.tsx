// Runtime theme: brand colours from GET /config layered over the static
// fallback palette, so a colour change in the owner dashboard actually repaints
// the app. Components read colours with useTheme(); themed StyleSheets are built
// with useThemedStyles(makeStyles) and rebuilt only when the palette changes.
import React, { createContext, useContext, useMemo } from 'react';
import { colors as fallback, deriveColors, type ThemeColors } from './theme';
import { useStore } from './store';

const ThemeContext = createContext<ThemeColors>(fallback);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const primaryColor = useStore((s) => s.config?.brand?.primaryColor);
  const accentColor = useStore((s) => s.config?.brand?.accentColor);
  const value = useMemo(
    () => deriveColors({ primaryColor, accentColor }),
    [primaryColor, accentColor],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}

// makeStyles(c) is a module-scope factory; this rebuilds it only when the
// palette changes so normal re-renders reuse the same StyleSheet.
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const c = useTheme();
  return useMemo(() => factory(c), [c, factory]);
}
