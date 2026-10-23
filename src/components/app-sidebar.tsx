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
  Bug,
  Target,
  BarChart3,
  ClipboardList,
  FolderOpen,
  Shield,
  Gamepad2,
  MoreHorizontal,
  Network,
  PenLine,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/hooks/use-supabase"
import { BugReportDialog } from "@/components/bug-report-dialog"
import { isAdmin } from "@/lib/auth-roles"

const todayItems = [
  {
    title: "Dashboard",
    subtitle: "Ringkasan progres belajarmu",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Peta Belajar",
    subtitle: "Jalur belajar Mandarin kamu",
    url: "/dashboard/path",
    icon: Target,
  },
  {
    title: "Statistik",
    subtitle: "Pantau progres dan pencapaian",
    url: "/dashboard/statistik",
    icon: BarChart3,
  },
]

const belajarItems = [
  {
    title: "Modul",
    subtitle: "Materi belajar terstruktur",
    url: "/dashboard/modul",
    icon: FolderOpen,
  },
  {
    title: "Daftar Kata",
    subtitle: "Kosakata dan latihan flashcard",
    url: "/dashboard/flashcard",
    icon: Languages,
  },
  {
    title: "Estafet",
    subtitle: "Latihan memahami kalimat",
    url: "/dashboard/flashcard/cumulative",
    icon: Layers,
  },
  {
    title: "Peta Hanzi",
    subtitle: "Jelajahi karakter dan komponennya",
    url: "/dashboard/peta-hanzi",
    icon: Network,
  },
  {
    title: "Mini Games",
    subtitle: "Belajar lewat permainan",
    url: "/dashboard/games",
    icon: Gamepad2,
  },
]

const learningPathItems = [
  {
    title: "Tata Bahasa",
    subtitle: "Pola dan aturan bahasa Mandarin",
    url: "/dashboard/grammar",
    icon: BookOpen,
  },
  {
    title: "Simulasi Ujian HSK",
    subtitle: "Latihan dengan format ujian HSK",
    url: "/dashboard/simulasi-hsk",
    icon: ClipboardList,
  },
  {
    title: "Baca",
    subtitle: "Baca cerita Mandarin",
    url: "/dashboard/cerita",
    icon: BookMarked,
  },
  {
    title: "Tulis Hanzi",
    subtitle: "Latihan menulis karakter Mandarin",
    url: "/dashboard/tulis-hanzi",
    icon: PenLine,
  },
]

const personalCollectionItems = [
  {
    title: "Favorit",
    subtitle: "Kosakata yang kamu simpan",
    url: "/dashboard/favorit",
    icon: Star,
  },
  {
    title: "Deck Saya",
    subtitle: "Deck kosakata buatanmu",
    url: "/dashboard/personal-cards",
    icon: FolderHeart,
  },
]

const adminItems = [
  {
    title: "Dashboard Admin",
    subtitle: "Kelola sistem dan pengguna",
    url: "/dashboard/admin",
    icon: Shield,
  },
]


export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string }
}) {
  const pathname = usePathname()
  const activeRoute = [...todayItems, ...belajarItems, ...learningPathItems, ...personalCollectionItems, ...adminItems]
    .filter((item) => pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(`${item.url}/`)))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url
  const isActiveRoute = (url: string) => activeRoute === url
  const router = useRouter()
  const { isMobile, setOpen, setOpenMobile, pinned } = useSidebar()
  const [bugReportOpen, setBugReportOpen] = React.useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false)
  const [isAdminUser, setIsAdminUser] = React.useState(false)
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

  // Check if user is admin
  React.useEffect(() => {
    async function checkAdmin() {
      try {
        const adminStatus = await isAdmin()
        setIsAdminUser(adminStatus)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAdminUser(false)
      }
    }
    checkAdmin()
  }, [])

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
          <span className="truncate text-base font-bold">
            <span className="text-black dark:text-white">JOURNEY</span><span className="ml-0.5 text-xl text-primary">.</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard & Modul */}
        <div className="hidden px-3 md:block">
          <div className="mb-2 px-2 pt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            MENU UTAMA
          </div>
          <SidebarMenu className="gap-1.5">
            {todayItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                {(() => {
                  const active = isActiveRoute(item.url)
                  return (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
                  className="h-auto min-h-8 p-3"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex min-w-0 flex-col group-data-[collapsed=true]/sidebar:hidden">
                      <span className="font-medium">{item.title}</span>
                      {active && <span className="text-[10px] leading-tight text-inherit opacity-80">{item.subtitle}</span>}
                    </span>
                  </div>
                </SidebarMenuButton>
                  )
                })()}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* BELAJAR */}
        <div className="px-3 mt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
            BELAJAR
          </div>
          <SidebarMenu className="gap-1.5">
            {belajarItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                {(() => {
                  const active = isActiveRoute(item.url)
                  return (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
                  className="h-auto min-h-8 p-3"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex min-w-0 flex-col group-data-[collapsed=true]/sidebar:hidden">
                      <span className="font-medium">{item.title}</span>
                      {active && <span className="text-[10px] leading-tight text-inherit opacity-80">{item.subtitle}</span>}
                    </span>
                  </div>
                </SidebarMenuButton>
                  )
                })()}
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
                {(() => {
                  const active = isActiveRoute(item.url)
                  return (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
                  className="h-auto min-h-8 p-3"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex min-w-0 flex-col group-data-[collapsed=true]/sidebar:hidden">
                      <span className="font-medium">{item.title}</span>
                      {active && <span className="text-[10px] leading-tight text-inherit opacity-80">{item.subtitle}</span>}
                    </span>
                  </div>
                </SidebarMenuButton>
                  )
                })()}
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
                {(() => {
                  const active = isActiveRoute(item.url)
                  return (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  render={<Link href={item.url} onClick={closeMobileSidebar} />}
                  className="h-auto min-h-8 p-3"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex min-w-0 flex-col group-data-[collapsed=true]/sidebar:hidden">
                      <span className="font-medium">{item.title}</span>
                      {active && <span className="text-[10px] leading-tight text-inherit opacity-80">{item.subtitle}</span>}
                    </span>
                  </div>
                </SidebarMenuButton>
                  )
                })()}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* ADMIN - hanya muncul untuk admin */}
        {isAdminUser && (
          <div className="hidden px-3 mt-4 md:block">
            <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider group-data-[collapsed=true]/sidebar:hidden">
              ADMIN
            </div>
            <SidebarMenu className="gap-1">
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {(() => {
                    const active = isActiveRoute(item.url)
                    return (
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={active}
                    render={<Link href={item.url} onClick={closeMobileSidebar} />}
                    className="h-auto min-h-8 p-3"
                  >
                    <div className="flex w-full min-w-0 items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{item.title}</span>
                        {active && <span className="text-[10px] leading-tight text-inherit opacity-80">{item.subtitle}</span>}
                      </span>
                    </div>
                  </SidebarMenuButton>
                    )
                  })()}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        )}
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
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground group-data-[collapsed=true]/sidebar:hidden" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-sidebar border-sidebar-border shadow-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  {!isMobile && (
                    <DropdownMenuItem onClick={handleProfileClick}>
                      <User className="h-4 w-4" />
                      Profil
                    </DropdownMenuItem>
                  )}
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
                <DropdownMenuItem onClick={() => setLogoutDialogOpen(true)} className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                  <LogOut className="h-4 w-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <BugReportDialog open={bugReportOpen} onOpenChange={setBugReportOpen} />

      {/* Logout Confirm Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 mb-1">
              <LogOut className="h-5 w-5 text-red-500" />
            </div>
            <DialogTitle className="text-base">Keluar dari akun?</DialogTitle>
            <DialogDescription>
              Kamu akan keluar dari sesi belajar sekarang. Progresmu sudah tersimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setLogoutDialogOpen(false)}
              className="flex-1 sm:flex-none rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-none rounded-lg bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              Ya, Keluar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
