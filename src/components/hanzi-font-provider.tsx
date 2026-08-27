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
  const styleSheetRef = React.useRef<HTMLStyleElement | null>(null)

  React.useEffect(() => {
    loadUserFont()
  }, [])

  async function loadUserFont() {
    const settings = await fetchUserSettings()
    if (settings?.hanziFont) {
      setUserFont(settings.hanziFont as HanziFont)
    }
    setIsLoaded(true)
  }

  React.useEffect(() => {
    if (isLoaded) {
      const fontToUse = userFont || "noto-sans-sc"
      const fontFamily = FONT_FAMILY_VALUES[fontToUse]
      
      // Remove old style sheet if exists
      if (styleSheetRef.current) {
        styleSheetRef.current.remove()
      }
      
      // Create new style sheet - ONLY target Hanzi elements
      const styleSheet = document.createElement('style')
      styleSheet.innerHTML = `
        /* Target all elements with font-hanzi class */
        .font-hanzi {
          font-family: ${fontFamily} !important;
        }
        
        /* Update CSS variable globally */
        :root, html, body {
          --font-hanzi: ${fontFamily} !important;
        }
      `
      document.head.appendChild(styleSheet)
      styleSheetRef.current = styleSheet
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
