"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SidebarHoverTrigger } from "@/components/sidebar-hover-trigger"
import { AppSidebar } from "@/components/app-sidebar"
import { isMobileBottomNavHidden, MobileBottomNav } from "@/components/mobile-bottom-nav"
import { DashboardHeader } from "@/components/dashboard-header"
import { NavigationProgress } from "@/components/navigation-progress"
import { PWAInstall } from "@/components/pwa-install"
import { ActiveStudyTimeTracker } from "@/components/active-study-time-tracker"
import { StreakCelebration } from "@/components/streak-celebration"
// Registrasi window.openBugReportModal — HARUS di-import dari sini (Client
// Component), bukan dari dashboard/layout.tsx (Server Component), supaya
// beneran jalan di browser. Lihat komentar di lib/global-bug-report.ts.
import "@/lib/global-bug-report"

type DashboardLayoutClientProps = {
  children: React.ReactNode
  sidebarUser: { name: string; email: string; avatar: string }
  defaultPinned: boolean
}

type DashboardRouteHistory = {
  routes: string[]
  cursor: number
  savedAt: number
}

type DashboardRouteRestoration = {
  routes: string[]
  nextIndex: number
  pendingTarget: string | null
}

const DASHBOARD_ROUTE_HISTORY_KEY = "pwa_dashboard_route_history"
const LAST_DASHBOARD_ROUTE_KEY = "pwa_last_dashboard_route"

function isSafeDashboardRoute(route: unknown): route is string {
  return typeof route === "string" && /^\/dashboard(?:\/|$)/.test(route) && !route.startsWith("//")
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
  const routeHistoryRef = React.useRef<DashboardRouteHistory | null>(null)
  const routeRestorationRef = React.useRef<DashboardRouteRestoration | null>(null)
  const popNavigationRef = React.useRef(false)
  const isChromeLess = CHROME_LESS_ROUTES.some((route) => pathname?.startsWith(route))
  const hideMobileBottomNav = isMobileBottomNavHidden(pathname)
  const hideDashboardHeader = Boolean(pathname && (
    pathname.startsWith("/dashboard/modul/") ||
    pathname.startsWith("/dashboard/practice/") ||
    pathname.startsWith("/dashboard/cerita/") ||
    (pathname.startsWith("/dashboard/flashcard/") && pathname !== "/dashboard/flashcard/cumulative") ||
    pathname.startsWith("/dashboard/personal-cards/latihan/sesi") ||
    pathname.startsWith("/dashboard/quiz/") ||
    pathname.startsWith("/dashboard/review/fast") ||
    pathname.startsWith("/dashboard/games/")
  ))
  const dashboardDesktopGutter = pathname === "/dashboard" ? "lg:px-[5%]" : ""

  React.useEffect(() => {
    if (!pathname) return

    try {
      const currentRoute = `${pathname}${window.location.search}`
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))

      if (!checkedPwaResume.current) {
        checkedPwaResume.current = true
        const savedHistoryValue = window.localStorage.getItem(DASHBOARD_ROUTE_HISTORY_KEY)
        const savedLastRouteValue = window.localStorage.getItem(LAST_DASHBOARD_ROUTE_KEY)
        let savedHistory: DashboardRouteHistory | null = null

        try {
          if (savedHistoryValue) {
            const parsed = JSON.parse(savedHistoryValue) as Partial<DashboardRouteHistory>
            const routes = Array.isArray(parsed.routes) ? parsed.routes.filter(isSafeDashboardRoute) : []
            const cursor = typeof parsed.cursor === "number" ? parsed.cursor : routes.length - 1
            if (routes.length > 0 && cursor >= 0 && cursor < routes.length) {
              savedHistory = { routes, cursor, savedAt: parsed.savedAt ?? 0 }
            }
          } else if (savedLastRouteValue) {
            // Migrate the older single-route record so existing installs keep
            // their last page on the next PWA launch.
            const parsed = JSON.parse(savedLastRouteValue) as { path?: string; savedAt?: number }
            if (isSafeDashboardRoute(parsed.path)) {
              savedHistory = { routes: [parsed.path], cursor: 0, savedAt: parsed.savedAt ?? 0 }
            }
          }
        } catch {
          window.localStorage.removeItem(DASHBOARD_ROUTE_HISTORY_KEY)
          window.localStorage.removeItem(LAST_DASHBOARD_ROUTE_KEY)
        }

        const savedCurrentRoute = savedHistory?.routes[savedHistory.cursor]
        const openedAtSavedRoute = currentRoute === savedCurrentRoute
        // A saved dashboard route stack remains valid across app closes and
        // longer idle periods. Expiring it after a few minutes made a normal
        // PWA relaunch start with a one-entry browser history, so Android Back
        // immediately closed the app instead of returning through prior pages.
        if (isStandalone && savedHistory && (pathname === "/dashboard" || openedAtSavedRoute)) {
          routeRestorationRef.current = {
            routes: savedHistory.routes.slice(0, savedHistory.cursor + 1),
            nextIndex: 0,
            pendingTarget: null,
          }
        }
      }

      const restoration = routeRestorationRef.current
      if (restoration) {
        if (restoration.pendingTarget) {
          // router.push/replace is asynchronous; ignore Strict Mode reruns
          // until the URL reaches the requested restoration step.
          if (currentRoute !== restoration.pendingTarget) return
          restoration.pendingTarget = null
          restoration.nextIndex += 1
        } else if (restoration.nextIndex === 0) {
          if (currentRoute === restoration.routes[0]) {
            restoration.nextIndex = 1
          } else {
            restoration.pendingTarget = restoration.routes[0]
            router.replace(restoration.routes[0])
            return
          }
        }

        if (restoration.nextIndex < restoration.routes.length) {
          const nextRoute = restoration.routes[restoration.nextIndex]
          restoration.pendingTarget = nextRoute
          router.push(nextRoute)
          return
        }

        const restoredHistory = {
          routes: restoration.routes,
          cursor: restoration.routes.length - 1,
          savedAt: Date.now(),
        }
        routeHistoryRef.current = restoredHistory
        routeRestorationRef.current = null
        window.localStorage.setItem(DASHBOARD_ROUTE_HISTORY_KEY, JSON.stringify(restoredHistory))
        window.localStorage.setItem(LAST_DASHBOARD_ROUTE_KEY, JSON.stringify({ path: currentRoute, savedAt: restoredHistory.savedAt }))
        return
      }

      if (!pathname.startsWith("/dashboard")) return

      let history = routeHistoryRef.current
      if (!history) {
        history = { routes: [currentRoute], cursor: 0, savedAt: Date.now() }
      } else if (history.routes[history.cursor] !== currentRoute) {
        if (popNavigationRef.current) {
          const previousIndex = history.routes.lastIndexOf(currentRoute, history.cursor - 1)
          const nextIndex = history.routes.indexOf(currentRoute, history.cursor + 1)
          const foundIndex = previousIndex >= 0 ? previousIndex : nextIndex
          if (foundIndex >= 0) {
            history.cursor = foundIndex
          } else {
            history.routes = [...history.routes.slice(0, history.cursor + 1), currentRoute]
            history.cursor = history.routes.length - 1
          }
        } else {
          history.routes = [...history.routes.slice(0, history.cursor + 1), currentRoute]
          history.cursor = history.routes.length - 1
        }
      }
      popNavigationRef.current = false

      // Bound local history size; dashboard navigation shouldn't grow storage
      // indefinitely on a frequently used device.
      if (history.routes.length > 50) {
        const removeCount = history.routes.length - 50
        history.routes = history.routes.slice(removeCount)
        history.cursor = Math.max(0, history.cursor - removeCount)
      }
      history.savedAt = Date.now()
      routeHistoryRef.current = history
      window.localStorage.setItem(DASHBOARD_ROUTE_HISTORY_KEY, JSON.stringify(history))
      window.localStorage.setItem(LAST_DASHBOARD_ROUTE_KEY, JSON.stringify({ path: currentRoute, savedAt: history.savedAt }))
    } catch {
      // Storage may be disabled by the browser; resume behavior is optional.
    }
  }, [pathname, router])

  React.useEffect(() => {
    const markRecentRoute = () => {
      try {
        const stored = window.localStorage.getItem(DASHBOARD_ROUTE_HISTORY_KEY)
        if (!stored) return
        const parsed = JSON.parse(stored) as DashboardRouteHistory
        parsed.savedAt = Date.now()
        window.localStorage.setItem(DASHBOARD_ROUTE_HISTORY_KEY, JSON.stringify(parsed))
        const lastRoute = parsed.routes[parsed.cursor]
        if (lastRoute) {
          window.localStorage.setItem(LAST_DASHBOARD_ROUTE_KEY, JSON.stringify({ path: lastRoute, savedAt: parsed.savedAt }))
        }
      } catch {
        // Ignore unavailable or malformed local storage.
      }
    }
    const markPopNavigation = () => { popNavigationRef.current = true }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") markRecentRoute()
    }

    window.addEventListener("pagehide", markRecentRoute)
    window.addEventListener("popstate", markPopNavigation)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("pagehide", markRecentRoute)
      window.removeEventListener("popstate", markPopNavigation)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  if (isChromeLess) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center overflow-y-auto bg-background">
        {children}
      </div>
    )
  }

  return (
    <SidebarProvider defaultOpen={true} defaultPinned={defaultPinned}>
      <ActiveStudyTimeTracker pathname={pathname} />
      <StreakCelebration />
      <NavigationProgress />
      <SidebarHoverTrigger />
      <AppSidebar user={sidebarUser} />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        {!hideDashboardHeader && <DashboardHeader />}

        <div className={`flex-1 min-h-0 overflow-auto ${dashboardDesktopGutter} ${hideMobileBottomNav
          ? ""
          : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"}`}>
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav />
      <PWAInstall />
    </SidebarProvider>
  )
}
