import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardLayoutClient } from "@/components/dashboard-layout-client"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profile")
    .select("display_name, custom_avatar_url, role")
    .eq("user_id", user.id)
    .maybeSingle()

  const sidebarUser = {
    name:
      profile?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Pelajar",
    email: user.email ?? "",
    // Prioritas: foto custom upload → Google OAuth avatar
    avatar: profile?.custom_avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
  }

  const cookieStore = await cookies()
  // The sidebar is pinned open (and stays open) if the user previously
  // toggled it on via the burger menu. Otherwise it starts hidden and only
  // appears on hover near the left edge.
  const defaultPinned = cookieStore.get("sidebar_pinned")?.value === "true"

  return (
    <DashboardLayoutClient sidebarUser={sidebarUser} defaultPinned={defaultPinned}>
      {children}
    </DashboardLayoutClient>
  )
}
