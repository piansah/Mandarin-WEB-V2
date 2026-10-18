"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"
type ThemeProviderProps = {
  children: React.ReactNode
  attribute?: "class" | `data-${string}`
  defaultTheme?: Theme
  enableSystem?: boolean
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  systemTheme: "light" | "dark"
  themes: Theme[]
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: "light" | "dark", attribute: ThemeProviderProps["attribute"]) {
  const root = document.documentElement
  if (attribute === "class") {
    root.classList.remove("light", "dark")
    root.classList.add(theme)
  } else if (attribute?.startsWith("data-")) {
    root.setAttribute(attribute, theme)
  }
  root.style.colorScheme = theme
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystemTheme = () => {
      const nextSystemTheme = media.matches ? "dark" : "light"
      setSystemTheme(nextSystemTheme)
      try {
        if (enableSystem && window.localStorage.getItem(storageKey) === "system") {
          applyTheme(nextSystemTheme, attribute)
        }
      } catch {
        if (enableSystem && defaultTheme === "system") applyTheme(nextSystemTheme, attribute)
      }
    }

    let initialTheme = defaultTheme
    try {
      const storedTheme = window.localStorage.getItem(storageKey)
      if (storedTheme === "light" || storedTheme === "dark" || (storedTheme === "system" && enableSystem)) {
        initialTheme = storedTheme
      }
    } catch {
      // Storage can be unavailable in private browsing; use the configured default.
    }

    const initialSystemTheme = media.matches ? "dark" : "light"
    setSystemTheme(initialSystemTheme)
    setThemeState(initialTheme)
    const activeInitialTheme = initialTheme === "system" && enableSystem
      ? initialSystemTheme
      : initialTheme === "dark" ? "dark" : "light"
    applyTheme(activeInitialTheme, attribute)
    media.addEventListener("change", updateSystemTheme)

    const syncStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      const nextTheme = event.newValue
      if (nextTheme !== "light" && nextTheme !== "dark" && !(nextTheme === "system" && enableSystem)) return
      setThemeState(nextTheme)
      const activeTheme = nextTheme === "system" && enableSystem
        ? getSystemTheme()
        : nextTheme === "dark" ? "dark" : "light"
      applyTheme(activeTheme, attribute)
    }
    window.addEventListener("storage", syncStorage)

    return () => {
      media.removeEventListener("change", updateSystemTheme)
      window.removeEventListener("storage", syncStorage)
    }
  }, [attribute, defaultTheme, enableSystem, storageKey])

  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<Theme>>>(nextTheme => {
    const resolved = typeof nextTheme === "function" ? nextTheme(theme) : nextTheme
    setThemeState(resolved)
    try {
      window.localStorage.setItem(storageKey, resolved)
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
    const activeTheme = resolved === "system" && enableSystem
      ? getSystemTheme()
      : resolved === "dark" ? "dark" : "light"
    if (resolved === "system" && enableSystem) setSystemTheme(activeTheme)
    applyTheme(activeTheme, attribute)
  }, [attribute, enableSystem, storageKey, theme])

  const resolvedTheme = theme === "system" && enableSystem ? systemTheme : theme
  const value = React.useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: resolvedTheme === "dark" ? "dark" : "light",
    systemTheme,
    themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
    setTheme,
  }), [enableSystem, resolvedTheme, setTheme, systemTheme, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
