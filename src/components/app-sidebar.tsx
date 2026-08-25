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
  ChevronRight,
  Settings,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Hanzi",
    url: "/dashboard/hanzi",
    icon: Languages,
  },
  {
    title: "Grammar",
    url: "/dashboard/grammar",
    icon: BookOpen,
  },
  {
    title: "Flashcard",
    icon: Layers,
    items: [
      { title: "Flashcard Kosakata", url: "/dashboard/flashcard" },
      { title: "Flashcard Kumulatif", url: "/dashboard/flashcard/cumulative" },
      { title: "Deck Pribadi", url: "/dashboard/personal-cards" },
    ],
  },
  {
    title: "Quiz",
    icon: FileText,
    items: [
      { title: "Quiz Harian", url: "/dashboard/quiz" },
      { title: "Quiz Kumulatif", url: "/dashboard/quiz/review" },
    ],
  },
  {
    title: "Cerita",
    url: "/dashboard/cerita",
    icon: BookMarked,
  },
  {
    title: "Favorit",
    url: "/dashboard/favorit",
    icon: Star,
  },
]

const navSecondary = [
  {
    title: "Pengaturan",
    url: "/dashboard/settings",
    icon: Settings,
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
  const defaultOpenSections = React.useMemo<Record<string, boolean>>(
    () => ({
      Flashcard: pathname.startsWith("/dashboard/flashcard") || pathname.startsWith("/dashboard/personal-cards"),
      Quiz: pathname.startsWith("/dashboard/quiz"),
    }),
    [pathname]
  )
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(defaultOpenSections)

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) =>
              item.items ? (
                <Collapsible
                  key={item.title}
                  open={openSections[item.title] ?? defaultOpenSections[item.title] ?? false}
                  onOpenChange={(open) => setOpenSections((current) => ({ ...current, [item.title]: open }))}
                  render={<SidebarMenuItem />}
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={item.items.some((subItem) => pathname.startsWith(subItem.url))}
                      />
                    }
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            isActive={pathname === subItem.url}
                            render={<Link href={subItem.url} />}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Lainnya</SidebarGroupLabel>
          <SidebarMenu>
            {navSecondary.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={pathname === item.url}
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
