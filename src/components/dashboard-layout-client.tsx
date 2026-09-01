"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SidebarHoverTrigger } from "@/components/sidebar-hover-trigger"
import { SidebarMobileOpenButton } from "@/components/sidebar-trigger"
import { AppSidebar } from "@/components/app-sidebar"
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

// Catatan: dulu ada logic `isFullscreen` di sini yang melewati sidebar +
// DashboardHeader untuk /dashboard/cerita/[key]/* dan
// /dashboard/flashcard/cumulative/[key]/* (rute "baca" dan "flashcard
// kumulatif"). Itu sisa dari desain lama saat semua halaman sesi memang
// fullscreen tanpa sidebar (lihat komentar di practice/layout.tsx). Sejak
// /practice dan flashcard biasa (swipe-flashcard-session.tsx) sengaja
// dipertahankan tetap punya sidebar + header, dua rute itu ketinggalan dan
// jadi tidak konsisten. Sekarang semua halaman dashboard, termasuk
// keduanya, lewat jalur layout yang sama di bawah ini.
export function DashboardLayoutClient({
  children,
  sidebarUser,
  defaultPinned,
}: DashboardLayoutClientProps) {
  return (
    <SidebarProvider defaultOpen={true} defaultPinned={defaultPinned}>
      <SidebarHoverTrigger />
      <SidebarMobileOpenButton />
      <AppSidebar user={sidebarUser} />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <DashboardHeader />

        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      <PWAInstall />
    </SidebarProvider>
  )
}