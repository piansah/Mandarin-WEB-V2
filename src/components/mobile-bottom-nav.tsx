"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BarChart3, LayoutDashboard, Map, Search, UserRound } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Peta Belajar", href: "/dashboard/path", icon: Map },
  { label: "Cari Kosakata", href: "/dashboard/flashcard?tab=search", icon: Search },
  { label: "Statistik", href: "/dashboard/statistik", icon: BarChart3 },
  { label: "Profil", href: "/dashboard/profile", icon: UserRound },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isMobile } = useSidebar()

  if (!isMobile) return null

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md",
        "pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
        "[.mobile-search-active_&]:hidden",
      )}
    >
      {navigationItems.map(({ label, href, icon: Icon }) => {
        const path = href.split("?")[0]
        const active = path === "/dashboard"
          ? pathname === path
          : path === "/dashboard/flashcard"
            ? pathname === path && searchParams.get("tab") === "search"
            : pathname === path || pathname.startsWith(`${path}/`)

        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-lg px-1 transition-colors duration-200 hover:text-foreground active:scale-95 motion-reduce:transition-none",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}
