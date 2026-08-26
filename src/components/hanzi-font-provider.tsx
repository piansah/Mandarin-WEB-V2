"use client"

import * as React from "react"
import { fetchUserSettings } from "@/lib/user-settings"

type HanziFont = "noto-sans-sc" | "ma-shan-zheng" | "zcool-xiao-wei" | "long-cang"

const FONT_FAMILY_VALUES: Record<HanziFont, string> = {
  "noto-sans-sc": "var(--font-noto-sans-sc), 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "ma-shan-zheng": "var(--font-ma-shan-zheng), 'Ma Shan Zheng', 'Noto Sans SC', sans-serif",
  "zcool-xiao-wei": "var(--font-zcool-xiao-wei), 'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif",
  "long-cang": "var(--font-long-cang), 'Long Cang', 'Noto Sans SC', sans-serif",
}

const HanziFontContext = React.createContext<string | null>(null)

export function HanziFontProvider({ children }: { children: React.ReactNode }) {
  const [userFont, setUserFont] = React.useState<HanziFont | null>(null)
  const [isLoaded, setIsLoaded] = React.useState(false)

  React.useEffect(() => {
    loadUserFont()
  }, [])

  async function loadUserFont() {
    const settings = await fetchUserSettings()
    console.log("Loading user settings:", settings)
    if (settings?.hanziFont) {
      console.log("Setting font to:", settings.hanziFont)
      setUserFont(settings.hanziFont as HanziFont)
    } else {
      console.log("No font preference found, using default")
    }
    setIsLoaded(true)
  }

  React.useEffect(() => {
    if (userFont && isLoaded) {
      const fontFamily = FONT_FAMILY_VALUES[userFont]
      console.log("Applying font family:", fontFamily)
      
      // Update the CSS variable directly to the font family string
      document.documentElement.style.setProperty("--font-hanzi", fontFamily)
      
      console.log("Font applied successfully")
    }
  }, [userFont, isLoaded])

  const currentFont = userFont ? FONT_FAMILY_VALUES[userFont] : null

  return (
    <HanziFontContext.Provider value={currentFont}>
      {children}
    </HanziFontContext.Provider>
  )
}

export function useHanziFont() {
  return React.useContext(HanziFontContext)
}
