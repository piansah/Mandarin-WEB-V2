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
  const isFullscreen = isCeritaRead || isCumulativeRead

  if (isFullscreen) {
    return (
      <SidebarProvider defaultOpen={false} defaultPinned={false}>
        <SidebarInset className="flex flex-col min-h-screen">
          <div className="flex-1 min-h-0 overflow-auto">
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