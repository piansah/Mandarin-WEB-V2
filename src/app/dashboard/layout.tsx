import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"
import { BugReportFab } from "@/components/bug-report-fab"
import { PWAInstall } from "@/components/pwa-install"
import { SidebarHoverTrigger } from "@/components/sidebar-hover-trigger"
import { SidebarMobileOpenButton } from "@/components/sidebar-trigger"
import { DashboardHeader } from "@/components/dashboard-header"
import "@/lib/global-bug-report"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const sidebarUser = {
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Pelajar",
    email: user.email ?? "",
    avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
  }

  const cookieStore = await cookies()
  // The sidebar is pinned open (and stays open) if the user previously
  // toggled it on via the burger menu. Otherwise it starts hidden and only
  // appears on hover near the left edge.
  const defaultPinned = cookieStore.get("sidebar_pinned")?.value === "true"

  return (
    <SidebarProvider defaultOpen={defaultPinned} defaultPinned={defaultPinned}>
      <SidebarHoverTrigger />
      <SidebarMobileOpenButton />
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      <BugReportFab />
      <PWAInstall />
    </SidebarProvider>
  )
}
