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
  CreditCard,
  Settings,
  ChevronRight,
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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
    items: [
      { title: "Semua Karakter", url: "/dashboard/hanzi" },
      { title: "Set Hanzi", url: "/dashboard/hanzi/sets" },
    ],
  },
  {
    title: "Grammar",
    url: "/dashboard/grammar",
    icon: BookOpen,
    items: [
      { title: "Pola Grammar", url: "/dashboard/grammar" },
      { title: "Latihan Grammar", url: "/dashboard/grammar/practice" },
    ],
  },
  {
    title: "Flashcard",
    url: "/dashboard/flashcard",
    icon: Layers,
    items: [
      { title: "Semua Deck", url: "/dashboard/flashcard" },
      { title: "Deck Pribadi", url: "/dashboard/flashcard/personal" },
    ],
  },
  {
    title: "Quiz",
    url: "/dashboard/quiz",
    icon: FileText,
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
    title: "Kartu Pribadi",
    url: "/dashboard/personal-cards",
    icon: CreditCard,
  },
  {
    title: "Pengaturan",
    url: "/dashboard/settings",
    icon: Settings,
  },
]

// Placeholder user — akan diganti dengan data session saat auth aktif
const placeholderUser = {
  name: "Pelajar",
  email: "pelajar@example.com",
  avatar: "",
}

function NavCollapsibleItem({ item, pathname }: { item: any; pathname: string }) {
  const [isOpen, setIsOpen] = React.useState(() => pathname.startsWith(item.url))

  React.useEffect(() => {
    if (pathname.startsWith(item.url)) {
      setIsOpen(true)
    }
  }, [pathname, item.url])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} />}>
          <item.icon />
          <span>{item.title}</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((sub: any) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton isActive={pathname === sub.url} render={<Link href={sub.url} />}>
                  {sub.title}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
            >
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
                <NavCollapsibleItem key={item.title} item={item} pathname={pathname} />

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
        <NavUser user={placeholderUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
