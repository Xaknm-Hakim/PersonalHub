"use client";

import * as React from "react";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("personalhub-theme") as Theme | null;
    applyTheme(savedTheme ?? getSystemTheme());
  }, []);

  return children;
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("personalhub-theme") as Theme | null;
    const initialTheme = savedTheme ?? getSystemTheme();
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    window.localStorage.setItem("personalhub-theme", nextTheme);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  return { theme, setTheme };
}
