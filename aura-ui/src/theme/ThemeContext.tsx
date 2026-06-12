import React, { createContext, useContext, useMemo } from "react";
import { darkPalette, lightPalette, setTheme } from "./index";

type ThemeColors = typeof lightPalette;

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightPalette,
});

export function ThemeProvider({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  const value = useMemo(() => {
    setTheme(isDark);
    return { isDark, colors: isDark ? darkPalette : lightPalette };
  }, [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
