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
  LogOut,
  FolderHeart,
  Flame,
  PanelLeft,
  PanelLeftClose,
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
import { createClient } from "@/lib/supabase/browser"

const todayItems = [
  {
    title: "Dashboard",
    description: "Beranda + ringkasan hari ini",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Modul",
    description: "Kurikulum & Pembelajaran",
    url: "/dashboard/modul",
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
    title: "Hanzi",
    url: "/dashboard/hanzi",
    icon: Languages,
  },
  {
    title: "Daftar Kata",
    url: "/dashboard/flashcard",
    icon: Layers,
  },
  {
    title: "Quiz Harian",
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
  const { isMobile, setOpen, open } = useSidebar()
  const [manuallyOpened, setManuallyOpened] = React.useState(false)

  // Listen for sidebar-toggle event from SidebarTrigger
  React.useEffect(() => {
    const handleToggle = (e: CustomEvent<boolean>) => {
      setManuallyOpened(e.detail)
    }
    window.addEventListener('sidebar-toggle', handleToggle as EventListener)
    return () => window.removeEventListener('sidebar-toggle', handleToggle as EventListener)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  async function handleProfileClick() {
    router.push("/dashboard/profile")
  }

  async function handleSettingsClick() {
    router.push("/dashboard/settings")
  }

  return (
    <Sidebar
      collapsible="none"
      onMouseEnter={() => {
        if (!isMobile) setOpen(true)
      }}
      onMouseLeave={() => {
        if (!isMobile && !manuallyOpened) setOpen(false)
      }}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="JOURNEY">
              <div className="text-left text-sm leading-tight">
                <span className="truncate font-bold text-sage-500 text-lg">JOURNEY<span className="text-white text-2xl ml-0.5">.</span></span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard & Modul */}
        <div className="px-3">
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
                    <span className="text-xs text-muted-foreground ml-6 group-data-[collapsed=true]/sidebar:hidden break-words">{item.description}</span>
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
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 group-data-[collapsed=true]/sidebar:hidden">
                    <span className="font-medium">{user.name}</span>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-fit"
                side="right"
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

      <SidebarRail />
    </Sidebar>
  )
}
