"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

export type AppTheme = "light" | "dark" | "system";

type ProviderProps = Omit<ThemeProviderProps, "attribute" | "defaultTheme" | "enableSystem"> & {
  defaultTheme?: AppTheme;
};

export function ThemeProvider({ children, defaultTheme = "system", ...props }: ProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export const useThemeMode = () => {
  const { theme, resolvedTheme, systemTheme, setTheme } = useNextTheme();
  const current = resolvedTheme ?? systemTheme ?? "light";

  return {
    theme: (theme ?? "system") as AppTheme,
    resolvedTheme: current as Exclude<AppTheme, "system">,
    systemTheme: (systemTheme ?? "light") as Exclude<AppTheme, "system">,
    setTheme,
  };
};
