"use client"

import { usePathname } from "next/navigation"
import { DashboardThemeToggle } from "@/components/dashboard-theme-toggle"

export function DashboardTopBar() {
  const pathname = usePathname()

  if (pathname !== "/dashboard") return null

  return <header className="flex h-14 shrink-0 items-center border-b border-border/50 px-4"><div className="flex-1" /><DashboardThemeToggle /></header>
}
