"use client"

import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

export function DashboardThemeToggle() {
  const pathname = usePathname()

  if (pathname !== "/dashboard") return null

  return <ThemeToggle />
}
