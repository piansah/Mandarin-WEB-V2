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
import { SidebarTrigger } from "@/components/ui/sidebar"
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
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar user={sidebarUser} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div className="flex items-center gap-2 p-4 border-b">
            <SidebarTrigger />
          </div>
          {children}
        </div>
      </SidebarInset>
      <BugReportFab />
      <PWAInstall />
    </SidebarProvider>
  )
}
