"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BookOpen,
  Languages,
  Layers,
  BookMarked,
  Star,
  Settings,
  User,
  LogOut,
  FolderHeart,
  Flame,
  Bug,
  ChevronRight,
  Target,
  BarChart3,
  RotateCcw,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { BugReportDialog } from "@/components/bug-report-dialog"

const todayItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Modul",
    url: "/dashboard/modul",
    icon: Layers,
  },
  {
    title: "Path",
    url: "/dashboard/path",
    icon: Target,
  },
  {
    title: "Statistik",
    url: "/dashboard/statistik",
    icon: BarChart3,
  },
]

const learningPathItems = [
  {
    title: "Grammar",
    url: "/dashboard/grammar",
    icon: BookOpen,
  },
  {
    title: "Daftar Kata",
    url: "/dashboard/flashcard",
    icon: Layers,
  },
  {
    title: "Estafet",
    url: "/dashboard/flashcard/cumulative",
    icon: Layers,
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
  const { isMobile, setOpen, setOpenMobile, pinned, togglePinned } = useSidebar()
  const [bugReportOpen, setBugReportOpen] = React.useState(false)
  const supabase = useSupabase()
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Save pinned state to cookie
  React.useEffect(() => {
    if (pinned) {
      document.cookie = "sidebar_pinned=true; path=/; max-age=31536000"
    } else {
      document.cookie = "sidebar_pinned=; path=/; max-age=0"
    }
  }, [pinned])

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  React.useEffect(() => clearCloseTimeout, [clearCloseTimeout])

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  React.useEffect(() => {
    closeMobileSidebar()
  }, [pathname, closeMobileSidebar])

  function handleMouseEnter() {
    if (isMobile) return
    clearCloseTimeout()
    setOpen(true)
  }

  function handleMouseLeave() {
    if (isMobile || pinned) return
    clearCloseTimeout()
    // Small delay avoids the sidebar flickering shut when the cursor
    // briefly crosses a gap (e.g. into a dropdown/menu portal).
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 200)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  async function handleProfileClick() {
    closeMobileSidebar()
    router.push("/dashboard/profile")
  }

  async function handleSettingsClick() {
    closeMobileSidebar()
    router.push("/dashboard/settings")
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      overlay={!pinned}
      className="border-r border-sidebar-border"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <SidebarHeader>
        <div className="px-2 py-1 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-[20%] bg-primary flex-shrink-0">
            <span className="font-hanzi text-xl font-bold text-white">木</span>
          </div>
          <span className="truncate text-lg font-bold">
            <span className="text-black dark:text-white">JOURNEY</span><span className="ml-0.5 text-2xl text-primary">.</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard & Modul */}
        <div className="px-3">
          <div className="mb-2 px-2 pt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            MENU UTAMA
          </div>
          <SidebarMenu className="gap-1">
            {todayItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
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
          <SidebarMenu className="gap-1">
            {learningPathItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
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
          <SidebarMenu className="gap-1">
            {personalCollectionItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="aria-expanded:bg-muted p-3 h-auto flex-col items-start" />
                }
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium flex-1 group-data-[collapsed=true]/sidebar:hidden">{user.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-data-[collapsed=true]/sidebar:hidden" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleProfileClick}>
                    <User className="h-4 w-4" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSettingsClick}>
                    <Settings className="h-4 w-4" />
                    Pengaturan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBugReportOpen(true)}>
                    <Bug className="h-4 w-4" />
                    Lapor Bug
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <BugReportDialog open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </Sidebar>
  )
}  