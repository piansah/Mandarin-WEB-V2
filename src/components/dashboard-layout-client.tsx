"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SidebarHoverTrigger } from "@/components/sidebar-hover-trigger"
import { AppSidebar } from "@/components/app-sidebar"
import { isMobileBottomNavHidden, MobileBottomNav } from "@/components/mobile-bottom-nav"
import { DashboardHeader } from "@/components/dashboard-header"
import { PWAInstall } from "@/components/pwa-install"
// Registrasi window.openBugReportModal — HARUS di-import dari sini (Client
// Component), bukan dari dashboard/layout.tsx (Server Component), supaya
// beneran jalan di browser. Lihat komentar di lib/global-bug-report.ts.
import "@/lib/global-bug-report"

type DashboardLayoutClientProps = {
  children: React.ReactNode
  sidebarUser: { name: string; email: string; avatar: string }
  defaultPinned: boolean
}

// Rute yang menjalankan pengalaman "chrome-less"nya sendiri — tanpa
// sidebar, tanpa header utama, konten diposisikan di tengah layar. Saat
// ini cuma onboarding/placement: user baru belum sempat kenal navigasi
// apa pun, jadi sidebar & header cuma jadi gangguan visual di step
// pertama mereka.
const CHROME_LESS_ROUTES = ["/dashboard/placement"]

// Catatan: dulu ada logic `isFullscreen` di sini yang melewati sidebar +
// DashboardHeader untuk /dashboard/cerita/[key]/* dan
// /dashboard/flashcard/cumulative/[key]/* (rute "baca" dan "flashcard
// kumulatif"). Itu sisa dari desain lama saat semua halaman sesi memang
// fullscreen tanpa sidebar (lihat komentar di practice/layout.tsx). Sejak
// /practice dan flashcard biasa (swipe-flashcard-session.tsx) sengaja
// dipertahankan tetap punya sidebar + header, dua rute itu ketinggalan dan
// jadi tidak konsisten. Sekarang semua halaman dashboard biasa, termasuk
// keduanya, lewat jalur layout yang sama di bawah ini — kecuali
// CHROME_LESS_ROUTES di atas, yang memang sengaja tidak pakai sidebar
// + header sama sekali (bukan sisa desain lama, ini keputusan baru).
export function DashboardLayoutClient({
  children,
  sidebarUser,
  defaultPinned,
}: DashboardLayoutClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const checkedPwaResume = React.useRef(false)
  const isChromeLess = CHROME_LESS_ROUTES.some((route) => pathname?.startsWith(route))
  const hideMobileBottomNav = isMobileBottomNavHidden(pathname)

  React.useEffect(() => {
    if (!pathname) return

    try {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
      const resumeKey = "pwa_last_dashboard_route"
      const resumeWindowMs = 10 * 60 * 1000

      if (!checkedPwaResume.current) {
        checkedPwaResume.current = true
        const savedValue = window.localStorage.getItem(resumeKey)
        if (savedValue) {
          try {
            const saved = JSON.parse(savedValue) as { path?: string; savedAt?: number }
            const age = Date.now() - (saved.savedAt ?? 0)
            const isRecent = age >= 0 && age <= resumeWindowMs
            if (isStandalone && pathname === "/dashboard" && isRecent && saved.path?.startsWith("/dashboard/") && !saved.path.startsWith("//")) {
              router.replace(saved.path)
              return
            }
            if (!isRecent) window.localStorage.removeItem(resumeKey)
          } catch {
            window.localStorage.removeItem(resumeKey)
          }
        }
      }

      if (pathname.startsWith("/dashboard")) {
        window.localStorage.setItem(resumeKey, JSON.stringify({
          path: `${pathname}${window.location.search}`,
          savedAt: Date.now(),
        }))
      }
    } catch {
      // Storage may be disabled by the browser; resume behavior is optional.
    }
  }, [pathname, router])

  if (isChromeLess) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center overflow-y-auto bg-background">
        {children}
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={true} defaultPinned={defaultPinned}>
      <SidebarHoverTrigger />
      <AppSidebar user={sidebarUser} />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <DashboardHeader />

        <div className={hideMobileBottomNav
          ? "flex-1 min-h-0 overflow-auto"
          : "flex-1 min-h-0 overflow-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"}>
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav />
      <PWAInstall />
    </SidebarProvider>
  )
}
