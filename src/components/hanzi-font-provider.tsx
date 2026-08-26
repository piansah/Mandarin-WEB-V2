"use client"

import * as React from "react"
import { fetchUserSettings } from "@/lib/user-settings"

type HanziFont = "noto-sans-sc" | "ma-shan-zheng" | "zcool-xiao-wei" | "long-cang"

const FONT_MAPPINGS: Record<HanziFont, string> = {
  "noto-sans-sc": "var(--font-hanzi)",
  "ma-shan-zheng": "var(--font-hanzi-ma-shan)",
  "zcool-xiao-wei": "var(--font-hanzi-zcool)",
  "long-cang": "var(--font-hanzi-long)",
}

const FONT_FAMILY_VALUES: Record<HanziFont, string> = {
  "noto-sans-sc": "var(--font-noto-sans-sc), 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "ma-shan-zheng": "var(--font-ma-shan-zheng), 'Ma Shan Zheng', 'Noto Sans SC', sans-serif",
  "zcool-xiao-wei": "var(--font-zcool-xiao-wei), 'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif",
  "long-cang": "var(--font-long-cang), 'Long Cang', 'Noto Sans SC', sans-serif",
}

export function HanziFontProvider({ children }: { children: React.ReactNode }) {
  const [userFont, setUserFont] = React.useState<HanziFont | null>(null)

  React.useEffect(() => {
    loadUserFont()
  }, [])

  async function loadUserFont() {
    const settings = await fetchUserSettings()
    if (settings?.hanziFont) {
      setUserFont(settings.hanziFont as HanziFont)
    }
  }

  React.useEffect(() => {
    if (userFont) {
      document.documentElement.style.setProperty("--font-hanzi", FONT_MAPPINGS[userFont])
      document.documentElement.style.setProperty("--font-hanzi-family", FONT_FAMILY_VALUES[userFont])
    }
  }, [userFont])

  return <>{children}</>
}
