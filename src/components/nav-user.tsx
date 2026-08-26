"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { UserIcon, SettingsIcon, Flame } from "lucide-react"
import { fetchUserProfile, type UserProfile } from "@/lib/user-profile"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [streak, setStreak] = React.useState<number>(0)

  React.useEffect(() => {
    fetchUserProfile().then(setProfile)
    // Fetch streak data (implement later)
    setStreak(1) // Placeholder
  }, [])

  const initials = user.name
    ? user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "CN"

  const displayAvatar = profile?.avatar || user.avatar

  return (
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
                <AvatarImage src={displayAvatar} alt={user.name} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{user.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push("/dashboard/settings")
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 w-full">
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs">
                <Flame className="h-3 w-3" />
                <span>{streak} hari streak</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                <UserIcon className="h-4 w-4" />
                Profil
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
