"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, BookMarked, BookOpen, Languages, LayoutDashboard, UserRound } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navigationItems = [
  { label: "Beranda", shortLabel: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { label: "Modul", shortLabel: "Modul", href: "/dashboard/modul", icon: BookOpen },
  { label: "Daftar Kata", shortLabel: "Daftar Kata", href: "/dashboard/flashcard", icon: Languages },
  { label: "Membaca", shortLabel: "Membaca", href: "/dashboard/cerita", icon: BookMarked },
  { label: "Statistik", shortLabel: "Statistik", href: "/dashboard/statistik", icon: BarChart3 },
  { label: "Profil", shortLabel: "Profil", href: "/dashboard/profile", icon: UserRound },
]

// Bottom navigation stays on section/list pages, then yields the viewport to
// focused content such as a deck, lesson, story, or practice session.
export function isMobileBottomNavHidden(pathname: string | null) {
  if (!pathname) return false

  return (
    pathname.startsWith("/dashboard/flashcard/") && pathname !== "/dashboard/flashcard/cumulative"
    || pathname.startsWith("/dashboard/modul/")
    || pathname.startsWith("/dashboard/cerita/")
    || pathname.startsWith("/dashboard/practice/")
    || pathname === "/dashboard/review"
    || pathname.startsWith("/dashboard/review/")
    || pathname.startsWith("/dashboard/personal-cards/")
    || pathname.startsWith("/dashboard/games/")
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const { isMobile } = useSidebar()

  if (!isMobile || isMobileBottomNavHidden(pathname)) return null

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-background/95 px-1 pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md",
        "pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
        "[.mobile-search-active_&]:hidden",
      )}
    >
      {navigationItems.map(({ label, shortLabel, href, icon: Icon }) => {
        const active = href === "/dashboard"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 transition-colors duration-200 hover:text-foreground active:scale-95 motion-reduce:transition-none",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full whitespace-nowrap text-[8px] font-medium leading-none" aria-hidden="true">{shortLabel}</span>
          </Link>
        )
      })}
    </nav>
  )
}
