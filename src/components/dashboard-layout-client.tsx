"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SidebarHoverTrigger } from "@/components/sidebar-hover-trigger"
import { SidebarMobileOpenButton } from "@/components/sidebar-trigger"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { PWAInstall } from "@/components/pwa-install"

type DashboardLayoutClientProps = {
  children: React.ReactNode
  sidebarUser: { name: string; email: string; avatar: string }
  defaultPinned: boolean
}

export function DashboardLayoutClient({
  children,
  sidebarUser,
  defaultPinned,
}: DashboardLayoutClientProps) {
  const pathname = usePathname()

  const segments = pathname.split("/").filter(Boolean)
  const isCeritaRead = segments.length >= 3 && segments[0] === "dashboard" && segments[1] === "cerita"
  const isCumulativeRead = segments.length >= 4 && segments[0] === "dashboard" && segments[1] === "flashcard" && segments[2] === "cumulative"
  // Sesi latihan kartu per-deck (/dashboard/practice/flashcard/[id])
  // SENGAJA TIDAK fullscreen — sidebar & DashboardHeader tetap tampil
  // seperti halaman dashboard lain, sesuai ekspektasi pengguna.
  //
  // Sebelumnya rute ini dipaksa fullscreen (sidebar/header disembunyikan)
  // karena `.page` di swipe-flashcard-session.module.css memakai
  // `height: 100dvh` + `overflow-y: auto` sebagai scroll container-nya
  // sendiri. Kalau dipasang di dalam wrapper `flex-1 overflow-auto` di
  // bawah, tinggi 100dvh yang FIXED itu bisa meluber dari tinggi wrapper
  // (yang sudah dipotong oleh DashboardHeader) sehingga muncul dua
  // scrollbar aktif sekaligus (scroll ganda).
  //
  // Sekarang `.page` sudah diubah memakai `min-height: 100dvh` TANPA
  // overflow sendiri (lihat swipe-flashcard-session.module.css), jadi
  // `.page` tidak lagi jadi scroll container kedua — satu-satunya yang
  // scroll adalah wrapper `flex-1 overflow-auto` di bawah, persis sama
  // seperti halaman dashboard lainnya. Dengan begitu rute ini aman
  // dirender di jalur normal (sidebar + header tetap terlihat).
  const isFullscreen = isCeritaRead || isCumulativeRead

  if (isFullscreen) {
    return (
      <SidebarProvider defaultOpen={false} defaultPinned={false}>
        <SidebarInset className="flex flex-col min-h-screen">
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider defaultOpen={true} defaultPinned={defaultPinned}>
      <SidebarHoverTrigger />
      <SidebarMobileOpenButton />
      <AppSidebar user={sidebarUser} />
      <SidebarInset className="flex flex-col min-h-screen">
        <DashboardHeader />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      <PWAInstall />
    </SidebarProvider>
  )
}