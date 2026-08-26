"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BookOpen,
  Languages,
  Layers,
  FileText,
  BookMarked,
  Star,
  Settings,
  User,
  Flame,
  Zap,
  RefreshCw,
  FolderHeart,
  PlusCircle,
  LogOut,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"

const todayItems = [
  {
    title: "Dashboard",
    description: "Beranda + ringkasan hari ini",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Sesi hari ini",
    description: "Latihan harian ~5 menit",
    url: "/dashboard/quiz",
    icon: Zap,
  },
  {
    title: "Modul",
    description: "Kurikulum yang sudah dipelajari",
    url: "/dashboard/flashcard",
    icon: Layers,
  },
]

const learningPathItems = [
  {
    title: "Grammar",
    url: "/dashboard/grammar",
    icon: BookOpen,
  },
  {
    title: "Kartu Hafalan",
    url: "/dashboard/flashcard",
    icon: Layers,
  },
  {
    title: "Quiz Latihan",
    url: "/dashboard/quiz",
    icon: FileText,
  },
  {
    title: "Kartu Kumulatif",
    url: "/dashboard/flashcard/cumulative",
    icon: Layers,
  },
  {
    title: "Quiz Kumulatif",
    url: "/dashboard/quiz/review",
    icon: FileText,
  },
  {
    title: "Baca",
    url: "/dashboard/cerita",
    icon: BookMarked,
  },
]

const personalCollectionItems = [
  {
    title: "Favorit",
    url: "/dashboard/favorit",
    icon: Star,
  },
  {
    title: "Deck Saya",
    url: "/dashboard/personal-cards",
    icon: FolderHeart,
  },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile, setOpen, toggleSidebar } = useSidebar()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => {
        if (!isMobile) setOpen(true)
      }}
      onMouseLeave={() => {
        if (!isMobile) setOpen(false)
      }}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="JOURNEY" onClick={toggleSidebar}>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold text-white text-lg">JOURNEY</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Profile Section */}
        <div className="px-3 py-4 group-data-[collapsed=true]/sidebar:hidden">
          <NavUser user={user} />
        </div>

        {/* HARI INI */}
        <div className="px-3">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            HARI INI
          </div>
          <SidebarMenu>
            {todayItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                  className="flex-col items-start p-3 h-auto"
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium group-data-[collapsed=true]/sidebar:hidden">{item.title}</span>
                  </div>
                  {item.description && (
                    <span className="text-xs text-muted-foreground ml-6 group-data-[collapsed=true]/sidebar:hidden">{item.description}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* LATIHAN */}
        <div className="px-3 mt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            LATIHAN
          </div>
          <SidebarMenu>
            {learningPathItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                  className="p-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium group-data-[collapsed=true]/sidebar:hidden">{item.title}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* KOLEKSI PRIBADI */}
        <div className="px-3 mt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            KOLEKSI PRIBADI
          </div>
          <SidebarMenu>
            {personalCollectionItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                  className="p-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium group-data-[collapsed=true]/sidebar:hidden">{item.title}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsed=true]/sidebar:hidden">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
