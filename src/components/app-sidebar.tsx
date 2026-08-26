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
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

const todayItems = [
  {
    title: "Dashboard",
    description: "Beranda + ringkasan hari ini",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Kuis Harian", 
    description: "Latihan harian ~5 menit",
    url: "/dashboard/quiz",
    icon: Zap,
  },
  {
    title: "Review",
    description: "Ulangi kata yang salah",
    url: "/dashboard/quiz/review",
    icon: RefreshCw,
  },
]

const learningPathItems = [
  {
    title: "Flashcard",
    description: "Kartu hafalan HSK",
    url: "/dashboard/flashcard",
    icon: Layers,
  },
  {
    title: "Hanzi",
    description: "Latihan tulis karakter",
    url: "/dashboard/hanzi",
    icon: Languages,
  },
  {
    title: "Grammar",
    description: "Pola kalimat & tata bahasa",
    url: "/dashboard/grammar",
    icon: BookOpen,
  },
  {
    title: "Cerita",
    description: "Bacaan interaktif",
    url: "/dashboard/cerita",
    icon: BookMarked,
  },
]

const personalCollectionItems = [
  {
    title: "Favorit",
    description: "Kata/kalimat yang disimpan",
    url: "/dashboard/favorit",
    icon: Star,
  },
  {
    title: "Deck Saya",
    description: "Kartu personal buatan sendiri",
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
  const { isMobile, setOpen, toggleSidebar } = useSidebar()

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
            <SidebarMenuButton size="lg" tooltip="Buka/tutup sidebar" onClick={toggleSidebar}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                学
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Mandarin Journey</span>
                <span className="truncate text-xs text-muted-foreground">HSK 3.0</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Profile Section */}
        <div className="px-3 py-4">
          <NavUser user={user} />
        </div>

        {/* HARI INI */}
        <div className="px-3">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-6">{item.description}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* JALUR PEMBELAJARAN */}
        <div className="px-3 mt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            JALUR PEMBELAJARAN
          </div>
          <SidebarMenu>
            {learningPathItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                  className="flex-col items-start p-3 h-auto"
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-6">{item.description}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* KOLEKSI PRIBADI */}
        <div className="px-3 mt-4">
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            KOLEKSI PRIBADI
          </div>
          <SidebarMenu>
            {personalCollectionItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                  className="flex-col items-start p-3 h-auto"
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-6">{item.description}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
